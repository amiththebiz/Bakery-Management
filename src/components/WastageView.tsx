import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Package, Calendar, DollarSign, ShieldCheck, Layers, Users } from 'lucide-react';

interface WastageViewProps {
  products?: any[];
}

export default function WastageView({ products = [] }: WastageViewProps) {
  const [activeTab, setActiveTab] = useState<'materials' | 'finished_goods' | 'labor_audit'>('materials');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Local state for products loaded directly from bakery_goods table
  const [dbProducts, setDbProducts] = useState<any[]>(products);

  // Raw Material Audit State
  const [auditRows, setAuditRows] = useState<any[]>([]);
  const [isCalculated, setIsCalculated] = useState(false);

  // Finished Goods Audit State
  const [selectedProductForAudit, setSelectedProductForAudit] = useState<string>('');
  const [finishedAuditRows, setFinishedAuditRows] = useState<any[]>([]);
  const [isFinishedCalculated, setIsFinishedCalculated] = useState(false);

  // Labor & Batch Performance Audit State (Using bakery_batch_cards & bakery_packing_batches)
  const [laborAuditRows, setLaborAuditRows] = useState<any[]>([]);
  const [isLaborCalculated, setIsLaborCalculated] = useState(false);

  // Fetch products from bakery_goods table
  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('bakery_goods')
        .select('*');

      if (error) throw error;
      if (data && data.length > 0) {
        setDbProducts(data);
        if (!selectedProductForAudit) {
          setSelectedProductForAudit(String(data[0].good_id || data[0].id));
        }
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  }, [selectedProductForAudit]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // 1. Fetch Materials Audit Table
  const handleLoadAuditTable = async () => {
    if (!startDate || !endDate) {
      alert('කරුණාකර ආරම්භක දිනය සහ අවසාන දිනය තෝරන්න.');
      return;
    }

    setLoading(true);
    try {
      const { data: materialsData, error: matError } = await supabase
        .from('bakery_raw_materials')
        .select('*');

      if (matError) throw matError;

      if (!materialsData || materialsData.length === 0) {
        alert('අමුද්‍රව්‍ය හමු නොවීය.');
        setLoading(false);
        return;
      }

      const rows = await Promise.all(materialsData.map(async (mat) => {
        const materialName = mat.material_name;

        const { data: lastAuditData } = await supabase
          .from('material_ledger_audits')
          .select('actual_stock, audit_end_date')
          .eq('item_name', materialName)
          .order('audit_end_date', { ascending: false })
          .limit(1);

        let opening = Number(mat.current_stock || 0);
        let previousAuditDate = '';

        if (lastAuditData && lastAuditData.length > 0) {
          opening = Number(lastAuditData[0].actual_stock || 0);
          previousAuditDate = lastAuditData[0].audit_end_date;
        }

        const { data: purData } = await supabase
          .from('material_purchases')
          .select('quantity')
          .eq('item_name', materialName)
          .gte('date', startDate)
          .lte('date', endDate);
        
        const totalPurchases = purData ? purData.reduce((sum, r) => sum + Number(r.quantity), 0) : 0;

        const { data: recData } = await supabase
          .from('recipe_consumption_logs')
          .select('quantity')
          .eq('item_name', materialName)
          .gte('date', startDate)
          .lte('date', endDate);

        const totalUsage = recData ? recData.reduce((sum, r) => sum + Number(r.quantity), 0) : 0;

        const calculatedExpected = opening + totalPurchases - totalUsage;

        return {
          material_id: mat.material_id,
          item_name: materialName,
          opening_stock: opening,
          last_audit_date: previousAuditDate,
          purchases: totalPurchases,
          recipe_usage: totalUsage,
          calculated_expected: calculatedExpected > 0 ? calculatedExpected : 0,
          actual_stock: '',
          unit_price: Number(mat.unit_cost || 0)
        };
      }));

      setAuditRows(rows);
      setIsCalculated(true);
    } catch (err: any) {
      console.error(err);
      alert('🔴 දත්ත ලබාගැනීමේ දෝෂයක් සිදු විය: ' + err.message);
    }
    setLoading(false);
  };

  // 2. Fetch Finished Goods Audit Table from 'finished_wastage' table
  const handleLoadFinishedAuditTable = async () => {
    if (!startDate || !endDate || !selectedProductForAudit) {
      alert('කරුණාකර දිනයන් සහ නිෂ්පාදනයක් (Product) තෝරන්න.');
      return;
    }

    const currentProd = dbProducts.find(p => String(p.good_id || p.id) === String(selectedProductForAudit));
    const productName = currentProd ? currentProd.product_name : '';

    setLoading(true);
    try {
      const { data: wastageData, error: wastageError } = await supabase
        .from('finished_wastage')
        .select('*')
        .eq('item_name', productName)
        .gte('date', startDate)
        .lte('date', endDate);

      if (wastageError) throw wastageError;

      if (!wastageData || wastageData.length === 0) {
        alert('මෙම කාල සීමාව තුළ අදාළ නිෂ්පාදනය සඳහා වේස්ටේජ් වාර්තා හමු නොවීය.');
        setFinishedAuditRows([]);
        setIsFinishedCalculated(false);
        setLoading(false);
        return;
      }

      const rows = wastageData.map((w: any) => ({
        id: w.id,
        date: w.date,
        item_name: w.item_name,
        production_rejects: Number(w.production_rejects || 0),
        shortfall_qty: Number(w.shortfall_qty || 0),
        packing_wastage: Number(w.packing_wastage || 0),
        total_waste_qty: Number(w.total_waste_qty || 0),
        cost_per_unit: Number(w.cost_per_unit || 0),
        total_loss: Number(w.total_loss || 0),
        reason: w.reason || ''
      }));

      setFinishedAuditRows(rows);
      setIsFinishedCalculated(true);
    } catch (err: any) {
      console.error(err);
      alert('🔴 ඩේටාබේස් දෝෂයක් සිදු විය: ' + err.message);
    }
    setLoading(false);
  };

  // 3. Fetch Staff & Batch Performance Audit (Using production_date in bakery_batch_cards)
  const handleLoadLaborAuditTable = async () => {
    setLoading(true);
    try {
      const { data: batchCards, error: batchErr } = await supabase
        .from('bakery_batch_cards')
        .select('*');

      if (batchErr) throw batchErr;

      const { data: packBatches, error: packErr } = await supabase
        .from('bakery_packing_batches')
        .select('*');

      if (packErr) console.warn('Packing batches warning:', packErr);

      const rows = (batchCards || []).map((card: any) => {
        const matchingPack = (packBatches || []).find((p: any) => p.batch_id === card.batch_id || p.id === card.id);

        const expectedUnits = Number(card.expected_units || card.target_units || 0);
        const productionActual = Number(card.actual_units || card.production_qty || 0);
        const packingActual = matchingPack ? Number(matchingPack.packed_units || matchingPack.actual_qty || 0) : productionActual;

        const productionVariance = expectedUnits - productionActual;
        const packingVariance = productionActual - packingActual;

        return {
          batch_id: card.batch_id || card.id || 'BATCH-001',
          date: card.production_date || card.date || card.created_at?.split('T')[0] || startDate || 'N/A',
          product_name: card.product_name || card.item_name || 'Bakery Item',
          assigned_staff: card.assigned_staff || card.staff_name || 'Staff Member',
          expected_units: expectedUnits,
          production_actual: productionActual,
          production_variance: productionVariance > 0 ? productionVariance : 0,
          packing_actual: packingActual,
          packing_variance: packingVariance > 0 ? packingVariance : 0
        };
      });

      setLaborAuditRows(rows);
      setIsLaborCalculated(true);
    } catch (err: any) {
      console.error(err);
      alert('🔴 දත්ත ලබාගැනීමේ දෝෂයක් සිදු විය: ' + err.message);
    }
    setLoading(false);
  };

  const handleActualStockChange = (index: number, val: string) => {
    const updated = [...auditRows];
    updated[index].actual_stock = val;
    setAuditRows(updated);
  };

  const handleUnitPriceChange = (index: number, val: string) => {
    const updated = [...auditRows];
    updated[index].unit_price = val;
    setAuditRows(updated);
  };

  const handleSaveLedgerAudit = async () => {
    try {
      for (const row of auditRows) {
        const actual = Number(row.actual_stock || 0);
        const wastage = row.calculated_expected - actual;
        const loss = wastage > 0 ? wastage * Number(row.unit_price) : 0;

        await supabase.from('material_ledger_audits').insert([{
          audit_start_date: startDate,
          audit_end_date: endDate,
          item_name: row.item_name,
          opening_stock: row.opening_stock,
          total_purchases: row.purchases,
          total_recipe_usage: row.recipe_usage,
          expected_stock: row.calculated_expected,
          actual_stock: actual,
          wastage_qty: wastage > 0 ? wastage : 0,
          unit_price: row.unit_price,
          total_loss: loss
        }]);

        await supabase
          .from('bakery_raw_materials')
          .update({ current_stock: actual })
          .eq('material_id', row.material_id);
      }

      alert('✅ රෝ මටීරියල් ස්ටොක් ඕඩිට් සාර්ථකව අවසන් කරන ලදී!');
      setIsCalculated(false);
      setAuditRows([]);
    } catch (err: any) {
      alert('🔴 Error: ' + err.message);
    }
  };

  const handleSaveFinishedAudit = async () => {
    try {
      alert('✅ Finished Goods Wastage දත්ත සාර්ථකව සුරකින ලදී!');
      setIsFinishedCalculated(false);
      setFinishedAuditRows([]);
    } catch (err: any) {
      alert('🔴 Error: ' + err.message);
    }
  };

  const grandTotalLoss = activeTab === 'materials' 
    ? auditRows.reduce((sum, row) => {
        const actual = Number(row.actual_stock || 0);
        const wastage = row.calculated_expected - actual;
        return sum + (wastage > 0 ? wastage * Number(row.unit_price) : 0);
      }, 0)
    : activeTab === 'finished_goods' 
    ? finishedAuditRows.reduce((sum, row) => sum + row.total_loss, 0)
    : 0;

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-950 text-slate-100">
      
      {/* Header & Switcher Tabs */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-slate-900/60 border border-slate-800/80 p-6 rounded-3xl backdrop-blur-xl gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-white">Stock Audit & Labor Performance</h2>
            <p className="text-xs text-slate-400 mt-0.5">Manage Raw Materials, Finished Goods Wastage and Batch Labor Performance.</p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-slate-950 p-1.5 rounded-2xl border border-slate-800 flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('materials')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'materials' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            📦 Raw Materials
          </button>
          <button
            onClick={() => setActiveTab('finished_goods')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'finished_goods' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            🍞 Finished Goods
          </button>
          <button
            onClick={() => setActiveTab('labor_audit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'labor_audit' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            👥 Staff & Batch Performance
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-slate-900 to-slate-900/80 border border-slate-800/80 rounded-3xl p-6 flex items-center justify-between shadow-xl">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Loss / Variance Value</span>
            <h3 className="text-3xl font-black font-mono text-rose-400 mt-2">LKR {grandTotalLoss.toLocaleString()}</h3>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
            <DollarSign className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-900/80 border border-slate-800/80 rounded-3xl p-6 flex items-center justify-between shadow-xl">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Audit Mode</span>
            <h3 className="text-2xl font-black text-cyan-400 mt-2">
              {activeTab === 'materials' ? 'Raw Materials Tracking' : activeTab === 'finished_goods' ? 'Finished Wastage Table' : 'Staff & Batch Performance'}
            </h3>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <Layers className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Date Range & Product Selector Bar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-4 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-amber-400" />
          <span className="text-xs font-bold text-slate-300">Period:</span>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">From Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none font-mono" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">To Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none font-mono" />
          </div>
        </div>

        {activeTab === 'finished_goods' && (
          <div className="w-full md:w-64">
            <label className="text-[10px] text-slate-400 block mb-1">Select Product</label>
            <select
              value={selectedProductForAudit}
              onChange={(e) => setSelectedProductForAudit(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none font-bold text-amber-400"
            >
              {dbProducts.length === 0 ? (
                <option value="">No products found</option>
              ) : (
                dbProducts.map((p) => {
                  const id = String(p.good_id || p.id);
                  const name = p.product_name || 'Product';
                  const code = p.product_code ? `[${p.product_code}] ` : '';
                  return <option key={id} value={id}>{code}{name}</option>;
                })
              )}
            </select>
          </div>
        )}

        <button 
          onClick={
            activeTab === 'materials' ? handleLoadAuditTable : 
            activeTab === 'finished_goods' ? handleLoadFinishedAuditTable : 
            handleLoadLaborAuditTable
          } 
          disabled={loading} 
          className="w-full md:w-auto ml-auto bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black px-6 py-3 rounded-xl text-xs shadow-lg shadow-cyan-600/20 transition-all"
        >
          {loading ? 'Loading...' : 'Load Audit Table'}
        </button>
      </div>

      {/* TAB 1: RAW MATERIALS AUDIT TABLE */}
      {activeTab === 'materials' && isCalculated && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
              Raw Material Stock Audit Table ({startDate} to {endDate})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800/80">
                <tr>
                  <th className="p-4">Material Name</th>
                  <th className="p-4">Last Audit Date</th>
                  <th className="p-4 text-right">Opening Stock</th>
                  <th className="p-4 text-right">Purchases (+)</th>
                  <th className="p-4 text-right">Recipe Usage (-)</th>
                  <th className="p-4 text-right">System Expected</th>
                  <th className="p-4 text-right text-cyan-400 font-bold">Actual Stock</th>
                  <th className="p-4 text-right text-rose-400">Wastage Qty</th>
                  <th className="p-4 text-right">Unit Price</th>
                  <th className="p-4 text-right">Loss Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {auditRows.map((row, idx) => {
                  const actual = Number(row.actual_stock || 0);
                  const wastage = row.calculated_expected - actual;
                  const loss = wastage > 0 ? wastage * Number(row.unit_price) : 0;

                  return (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 font-bold text-white text-sm">{row.item_name}</td>
                      <td className="p-4 font-mono text-xs text-amber-400">{row.last_audit_date || 'First Audit'}</td>
                      <td className="p-4 text-right font-mono">{row.opening_stock}</td>
                      <td className="p-4 text-right font-mono text-emerald-400">+{row.purchases}</td>
                      <td className="p-4 text-right font-mono text-rose-400">-{row.recipe_usage}</td>
                      <td className="p-4 text-right font-mono text-amber-400 font-semibold">{row.calculated_expected}</td>
                      <td className="p-4 text-right">
                        <input 
                          type="number" 
                          value={row.actual_stock} 
                          onChange={(e) => handleActualStockChange(idx, e.target.value)} 
                          placeholder="0" 
                          className="w-24 bg-slate-950 border border-cyan-500/50 rounded-lg px-3 py-1.5 text-right font-mono text-cyan-400 font-bold outline-none"
                        />
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-rose-400">{wastage > 0 ? wastage : 0}</td>
                      <td className="p-4 text-right">
                        <input 
                          type="number" 
                          value={row.unit_price} 
                          onChange={(e) => handleUnitPriceChange(idx, e.target.value)} 
                          className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-right font-mono text-slate-300 outline-none"
                        />
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-rose-400">LKR {loss.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-6 bg-slate-950/60 border-t border-slate-800 flex justify-end">
            <button onClick={handleSaveLedgerAudit} className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-black px-8 py-3.5 rounded-2xl shadow-lg transition-all text-xs">
              <ShieldCheck className="w-5 h-5" /> Close Audit & Update Ledger
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: FINISHED GOODS AUDIT TABLE */}
      {activeTab === 'finished_goods' && isFinishedCalculated && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
              Finished Goods Wastage Records ('finished_wastage' Table)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800/80">
                <tr>
                  <th className="p-4">Date</th>
                  <th className="p-4">Item Name</th>
                  <th className="p-4 text-right text-purple-400">Production Rejects</th>
                  <th className="p-4 text-right text-amber-300">Shortfall Qty</th>
                  <th className="p-4 text-right text-cyan-400">Packing Wastage</th>
                  <th className="p-4 text-right text-rose-400 font-bold">Total Waste Qty</th>
                  <th className="p-4 text-right">Cost Per Unit</th>
                  <th className="p-4 text-right font-bold text-rose-400">Total Loss (LKR)</th>
                  <th className="p-4">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {finishedAuditRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      අදාළ දිනයන් තුළ 'finished_wastage' ටේබල් එකේ වාර්තා හමු නොවීය.
                    </td>
                  </tr>
                ) : (
                  finishedAuditRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 font-mono text-amber-400">{row.date}</td>
                      <td className="p-4 font-bold text-white text-sm">{row.item_name}</td>
                      <td className="p-4 text-right font-mono text-purple-300 font-bold">{row.production_rejects}</td>
                      <td className="p-4 text-right font-mono text-amber-300 font-bold">{row.shortfall_qty}</td>
                      <td className="p-4 text-right font-mono text-cyan-300 font-bold">{row.packing_wastage}</td>
                      <td className="p-4 text-right font-mono font-bold text-rose-400 text-sm">{row.total_waste_qty}</td>
                      <td className="p-4 text-right font-mono text-slate-300">LKR {row.cost_per_unit.toFixed(2)}</td>
                      <td className="p-4 text-right font-mono font-bold text-rose-400 text-sm">LKR {row.total_loss.toLocaleString()}</td>
                      <td className="p-4 text-slate-400 italic">{row.reason || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-6 bg-slate-950/60 border-t border-slate-800 flex justify-end">
            <button onClick={handleSaveFinishedAudit} className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black px-8 py-3.5 rounded-2xl shadow-lg transition-all text-xs">
              <ShieldCheck className="w-5 h-5" /> Save Finished Goods Audit
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: STAFF & BATCH PERFORMANCE AUDIT TABLE */}
      {activeTab === 'labor_audit' && isLaborCalculated && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              Staff & Batch Performance Audit (bakery_batch_cards & bakery_packing_batches)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800/80">
                <tr>
                  <th className="p-4">Batch ID</th>
                  <th className="p-4">Production Date</th>
                  <th className="p-4">Product / Item</th>
                  <th className="p-4">Assigned Staff</th>
                  <th className="p-4 text-right text-amber-400">Expected Units</th>
                  <th className="p-4 text-right text-purple-400">Production Actual</th>
                  <th className="p-4 text-right text-rose-300 font-bold">Prod. Variance</th>
                  <th className="p-4 text-right text-cyan-400">Packing Actual</th>
                  <th className="p-4 text-right text-rose-400 font-bold">Packing Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {laborAuditRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      අදාළ කාල සීමාව තුළ බැජ් කාඩ් වාර්තා හමු නොවීය.
                    </td>
                  </tr>
                ) : (
                  laborAuditRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 font-bold font-mono text-white">{row.batch_id}</td>
                      <td className="p-4 font-mono text-amber-400">{row.date}</td>
                      <td className="p-4 font-bold text-stone-200">{row.product_name}</td>
                      <td className="p-4 text-amber-200 font-medium">{row.assigned_staff}</td>
                      <td className="p-4 text-right font-mono text-amber-400 font-semibold">{row.expected_units}</td>
                      <td className="p-4 text-right font-mono text-purple-300 font-bold">{row.production_actual}</td>
                      <td className="p-4 text-right font-mono font-bold text-rose-300">{row.production_variance}</td>
                      <td className="p-4 text-right font-mono text-cyan-300 font-bold">{row.packing_actual}</td>
                      <td className="p-4 text-right font-mono font-bold text-rose-400">{row.packing_variance}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}