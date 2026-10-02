import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Button, Spinner, Modal, Input } from '@/components/ui';
import { Package, RefreshCw, Layers, ChevronDown, ChevronUp, FileText, ArrowDownLeft, ArrowUpRight, Plus, Send, Clock, Truck } from 'lucide-react';

export default function FinishedGoods() {
  const [productCards, setProductCards] = useState<any[]>([]);
  const [pendingTransfersList, setPendingTransfersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Statement Modal states
  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [selectedProductStatement, setSelectedProductStatement] = useState<any>(null);

  // Opening Stock Modal states
  const [openStockModalOpen, setOpenStockModalOpen] = useState(false);
  const [openStockForm, setOpenStockForm] = useState({
    good_id: '',
    batch_number: `OPEN-${Math.floor(1000 + Math.random() * 9000)}`,
    production_date: new Date().toISOString().split('T')[0],
    quantity: ''
  });
  const [submittingOpenStock, setSubmittingOpenStock] = useState(false);
  const [goodsListForModal, setGoodsListForModal] = useState<any[]>([]);

  // Transfer Stock Modal states
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    good_id: '',
    product_name: '',
    quantity: '',
    destination: 'Distribution (GRN)',
    notes: '',
    batches: [] as any[],
    selected_batch_id: ''
  });
  const [submittingTransfer, setSubmittingTransfer] = useState(false);

  const fetchFactoryData = useCallback(async () => {
    setLoading(true);
    try {
      const goodsRes = await supabase.from('bakery_goods').select('*');
      const batchesRes = await supabase.from('bakery_finished_goods_batches').select('*');
      
      let stockOutData: any[] = [];
      try {
        const stockOutRes = await supabase.from('bakery_finished_goods_stock_out').select('*');
        stockOutData = stockOutRes.data || [];
        setPendingTransfersList(stockOutData);
      } catch (e) {
        console.warn('Stock out table might not exist:', e);
      }

      let productsData: any[] = [];
      try {
        const productsRes = await supabase.from('products').select('*');
        productsData = productsRes.data || [];
      } catch (e) {
        console.warn('Products table might not exist:', e);
      }

      const goods = goodsRes.data || [];
      setGoodsListForModal(goods);
      const finishedBatches = batchesRes.data || [];

      const distStockMap = new Map();
      productsData.forEach((p: any) => {
        const pName = String(p.product_name || p.name || '').trim().toLowerCase();
        const q = Number(p.stock || 0);
        if (pName) {
          const existing = distStockMap.get(pName) || 0;
          distStockMap.set(pName, existing + q);
        }
      });

      const factoryMap = new Map();

      finishedBatches.forEach((b: any) => {
        const units = Number(b.remaining_quantity !== undefined ? b.remaining_quantity : (b.quantity || b.initial_quantity || 0));
        const goodId = String(b.good_id);

        if (!factoryMap.has(goodId)) {
          factoryMap.set(goodId, {
            total_factory_stock: 0,
            batches: [],
            transactions: []
          });
        }

        const productGroup = factoryMap.get(goodId);
        productGroup.total_factory_stock += units;

        const batchObj = {
          id: b.id,
          batch_number: b.batch_number || b.batch_no || 'BATCH',
          production_date: b.production_date || b.date || new Date().toISOString().split('T')[0],
          quantity: units
        };
        productGroup.batches.push(batchObj);

        productGroup.transactions.push({
          date: batchObj.production_date,
          type: 'IN',
          reference: `Batch / Opening: ${batchObj.batch_number}`,
          qty: units,
          notes: 'Factory Entry'
        });
      });

      stockOutData.forEach((out: any) => {
        const goodId = String(out.good_id);
        const qtyOut = Number(out.quantity_out || 0);
        if (factoryMap.has(goodId) && qtyOut > 0) {
          const productGroup = factoryMap.get(goodId);
          productGroup.total_factory_stock -= qtyOut;

          productGroup.transactions.push({
            date: out.created_at ? out.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
            type: 'OUT (Pending GRN)',
            reference: `Destination: ${out.destination || 'Distribution'}`,
            qty: qtyOut,
            notes: out.notes || 'Transferred (Awaiting GRN Acceptance)',
            isPending: true
          });
        }
      });

      const cardsMap = new Map();

      goods.forEach((g: any) => {
        const goodId = String(g.good_id || g.id);
        const productName = String(g.product_name || g.name || 'Product').trim();
        const productCode = String(g.product_code || g.code || '').trim();
        const nameKey = productName.toLowerCase();

        const fData = factoryMap.get(goodId) || { total_factory_stock: 0, batches: [], transactions: [] };
        const factoryStock = Math.max(0, fData.total_factory_stock);
        const distStock = distStockMap.get(nameKey) || 0;

        cardsMap.set(goodId, {
          good_id: goodId,
          product_code: productCode || 'ITEM',
          product_name: productName,
          factory_stock: factoryStock,
          distribution_stock: distStock,
          total_stock: factoryStock + distStock,
          batches: fData.batches,
          transactions: fData.transactions
        });
      });

      setProductCards(Array.from(cardsMap.values()));

    } catch (err) {
      console.error('Error loading factory stock:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFactoryData();
  }, [fetchFactoryData]);

  const handleAddOpeningStock = async () => {
    if (!openStockForm.good_id || !openStockForm.batch_number || !openStockForm.quantity) {
      alert('Please fill in all required fields.');
      return;
    }

    setSubmittingOpenStock(true);
    try {
      const qtyNum = parseFloat(openStockForm.quantity) || 0;
      const { error } = await supabase.from('bakery_finished_goods_batches').insert({
        good_id: parseInt(openStockForm.good_id),
        batch_number: openStockForm.batch_number,
        production_date: openStockForm.production_date,
        initial_quantity: qtyNum,
        remaining_quantity: qtyNum
      });

      if (error) throw error;

      alert('Opening stock added successfully!');
      setOpenStockModalOpen(false);
      setOpenStockForm({
        good_id: '',
        batch_number: `OPEN-${Math.floor(1000 + Math.random() * 9000)}`,
        production_date: new Date().toISOString().split('T')[0],
        quantity: ''
      });
      fetchFactoryData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setSubmittingOpenStock(false);
  };

  const openTransferModal = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setTransferForm({
      good_id: item.good_id,
      product_name: item.product_name,
      quantity: '',
      destination: 'Distribution (GRN)',
      notes: '',
      batches: item.batches || [],
      selected_batch_id: item.batches?.[0]?.id ? String(item.batches[0].id) : ''
    });
    setTransferModalOpen(true);
  };

  const handleTransferStock = async () => {
    if (!transferForm.quantity || parseFloat(transferForm.quantity) <= 0) {
      alert('කරුණාකර නිවැරදි ප්‍රමාණයක් ඇතුළත් කරන්න.');
      return;
    }

    setSubmittingTransfer(true);
    try {
      const qty = parseFloat(transferForm.quantity);
      
      const { error } = await supabase.from('bakery_finished_goods_stock_out').insert({
        good_id: parseInt(transferForm.good_id),
        batch_id: transferForm.selected_batch_id ? parseInt(transferForm.selected_batch_id) : null,
        quantity_out: qty,
        destination: transferForm.destination,
        notes: transferForm.notes || 'Transferred to Distribution'
      });

      if (error) throw error;

      alert('Successfully transferred stock! (Pending GRN Acceptance)');
      setTransferModalOpen(false);
      fetchFactoryData();
    } catch (err: any) {
      alert('Error transferring stock: ' + err.message);
    }
    setSubmittingTransfer(false);
  };

  const toggleCardExpand = (goodId: string) => {
    if (expandedCard === goodId) {
      setExpandedCard(null);
    } else {
      setExpandedCard(goodId);
    }
  };

  const openStatementModal = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProductStatement({
      ...item,
      productName: item.product_code && item.product_code !== 'ITEM' && item.product_code !== 'DIST' ? `${item.product_code} — ${item.product_name}` : item.product_name
    });
    setStatementModalOpen(true);
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-8 pb-12">
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
            <Package className="h-6 w-6 text-amber-600" /> Finished Goods & Stock Overview
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">Product cards with Factory Stock, Distribution Stock, and Combined Totals.</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button onClick={fetchFactoryData} variant="secondary" className="text-xs flex items-center gap-1.5">
            <RefreshCw className="h-4 w-4" /> Refresh Stock
          </Button>
          <Button onClick={() => setOpenStockModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white text-xs flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Add Opening Stock
          </Button>
        </div>
      </div>

      {/* PENDING TRANSFERS TABLE */}
      {pendingTransfersList.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 p-5 rounded-2xl space-y-3">
          <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
            <Truck className="h-4 w-4 text-amber-700" /> Pending Transfers to Distribution (GRN එකෙන් පිළිගැනීමට ඇති තොග)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left bg-white rounded-xl overflow-hidden border">
              <thead className="bg-amber-100/70 text-amber-900 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Good ID</th>
                  <th className="p-2.5">Destination / Notes</th>
                  <th className="p-2.5 text-right">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {pendingTransfersList.map((pt: any, idx: number) => (
                  <tr key={idx} className="hover:bg-amber-50/40">
                    <td className="p-2.5 text-stone-600">{pt.created_at ? pt.created_at.split('T')[0] : 'Today'}</td>
                    <td className="p-2.5 font-bold text-stone-900">Product ID: {pt.good_id}</td>
                    <td className="p-2.5 text-stone-600">{pt.destination} <span className="text-[10px] text-stone-400 block">{pt.notes}</span></td>
                    <td className="p-2.5 text-right font-mono font-bold text-amber-800">{pt.quantity_out} Units</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRODUCT CARDS GRID */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-stone-800 flex items-center gap-2">
          <Layers className="h-4 w-4 text-amber-600" /> Product Stock Cards (Factory + Distribution Breakdown)
        </h2>

        {productCards.length === 0 ? (
          <Card className="p-12 text-center text-stone-400 text-xs">
            No products found. Please add goods to bakery_goods or products table.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {productCards.map(item => {
              const displayName = item.product_code && item.product_code !== 'ITEM' && item.product_code !== 'DIST' ? `${item.product_code} — ${item.product_name}` : item.product_name;
              const isExpanded = expandedCard === item.good_id;

              return (
                <Card 
                  key={item.good_id} 
                  className="p-5 space-y-4 border-t-4 border-amber-500 shadow-sm hover:shadow-md transition-all cursor-pointer bg-white"
                  onClick={() => toggleCardExpand(item.good_id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold uppercase">
                        {item.product_code}
                      </span>
                      <h3 className="font-bold text-stone-900 text-base mt-1.5">{displayName}</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-stone-400 block">Total Combined</span>
                      <span className="font-mono font-extrabold text-emerald-700 text-lg">{item.total_stock}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200 text-xs">
                    <div>
                      <span className="text-[10px] text-stone-400 block">Factory Stock</span>
                      <span className="font-mono font-bold text-amber-700">{item.factory_stock} Units</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 block">Distribution Stock</span>
                      <span className="font-mono font-bold text-purple-700">{item.distribution_stock} Units</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <Button 
                        onClick={(e) => openStatementModal(item, e)}
                        className="bg-stone-800 hover:bg-stone-900 text-white text-[10px] px-2.5 py-1.5 flex items-center gap-1 font-bold"
                      >
                        <FileText className="h-3.5 w-3.5" /> Statement
                      </Button>
                      <Button 
                        onClick={(e) => openTransferModal(item, e)}
                        className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] px-2.5 py-1.5 flex items-center gap-1 font-bold"
                      >
                        <Send className="h-3.5 w-3.5" /> Transfer
                      </Button>
                    </div>

                    <span className="flex items-center gap-1 text-amber-600 font-bold text-xs">
                      {isExpanded ? 'Hide' : 'Batches'} 
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </div>

                  {/* BATCH BREAKDOWN DROPDOWN */}
                  {isExpanded && (
                    <div className="space-y-2 pt-3 border-t border-stone-200 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                      <p className="text-[11px] font-bold text-stone-700 flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5 text-amber-600" /> Factory Batch-wise Breakdown:
                      </p>
                      {item.batches.length === 0 ? (
                        <p className="text-[10px] text-stone-400 italic">No active factory batches found.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {item.batches.map((batch: any, bIdx: number) => (
                            <div key={bIdx} className="bg-stone-50 p-2.5 rounded-xl border border-stone-200 flex justify-between items-center text-xs">
                              <div>
                                <span className="font-mono font-bold text-stone-800 bg-white px-2 py-0.5 rounded border">{batch.batch_number}</span>
                                <span className="text-[10px] text-stone-400 block mt-1">Date: {batch.production_date}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-mono font-bold text-amber-700 text-sm">{batch.quantity}</span>
                                <span className="text-[10px] text-stone-400 block">Units</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: ADD OPENING STOCK */}
      <Modal open={openStockModalOpen} onClose={() => setOpenStockModalOpen(false)} title="Add Opening Stock">
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Select Product</label>
            <select 
              value={openStockForm.good_id}
              onChange={(e) => setOpenStockForm({ ...openStockForm, good_id: e.target.value })}
              className="w-full border rounded-xl px-3 py-2 text-xs bg-white font-bold"
            >
              <option value="">-- Choose Product --</option>
              {goodsListForModal.map(g => (
                <option key={String(g.good_id || g.id)} value={String(g.good_id || g.id)}>
                  {g.product_code ? `${g.product_code} — ${g.product_name}` : g.product_name}
                </option>
              ))}
            </select>
          </div>

          <Input 
            label="Batch Number / Ref" 
            value={openStockForm.batch_number} 
            onChange={(v) => setOpenStockForm({ ...openStockForm, batch_number: v })} 
            placeholder="e.g. OPEN-001" 
          />

          <Input 
            label="Date" 
            type="date" 
            value={openStockForm.production_date} 
            onChange={(v) => setOpenStockForm({ ...openStockForm, production_date: v })} 
          />

          <Input 
            label="Initial Quantity" 
            type="number" 
            value={openStockForm.quantity} 
            onChange={(v) => setOpenStockForm({ ...openStockForm, quantity: v })} 
            placeholder="e.g. 500" 
          />

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setOpenStockModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddOpeningStock} disabled={submittingOpenStock} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
              {submittingOpenStock ? 'Saving...' : 'Save Opening Stock'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: TRANSFER STOCK TO DISTRIBUTION */}
      <Modal open={transferModalOpen} onClose={() => setTransferModalOpen(false)} title={`Transfer Stock: ${transferForm.product_name}`}>
        <div className="space-y-4 text-xs">
          <div className="bg-purple-50 p-3 rounded-xl border border-purple-200 text-purple-900 font-bold">
            භාණ්ඩ බෙදාහැරීමේ පද්ධතියට (Distribution GRN) යැවීම සඳහා බැච් එක සහ ප්‍රමාණය සඳහන් කරන්න.
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Select Batch</label>
            <select 
              value={transferForm.selected_batch_id}
              onChange={(e) => setTransferForm({ ...transferForm, selected_batch_id: e.target.value })}
              className="w-full border rounded-xl px-3 py-2 text-xs bg-white font-bold"
            >
              <option value="">-- Choose Factory Batch --</option>
              {transferForm.batches.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.batch_number} (Available: {b.quantity} Units)
                </option>
              ))}
            </select>
          </div>

          <Input 
            label="Quantity to Transfer" 
            type="number" 
            value={transferForm.quantity} 
            onChange={(v) => setTransferForm({ ...transferForm, quantity: v })} 
            placeholder="e.g. 100" 
          />

          <Input 
            label="Destination / Notes" 
            value={transferForm.notes} 
            onChange={(v) => setTransferForm({ ...transferForm, notes: v })} 
            placeholder="e.g. Sent via Delivery Van 01" 
          />

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setTransferModalOpen(false)}>Cancel</Button>
            <Button onClick={handleTransferStock} disabled={submittingTransfer} className="bg-purple-600 hover:bg-purple-700 text-white font-bold">
              {submittingTransfer ? 'Transferring...' : 'Confirm Transfer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* STATEMENT / LEDGER MODAL */}
      <Modal open={statementModalOpen} onClose={() => setStatementModalOpen(false)} title={`Stock Statement: ${selectedProductStatement?.productName}`}>
        <div className="space-y-4 text-xs">
          <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 flex justify-between items-center">
            <div>
              <span className="text-amber-800 font-bold block">Total Combined Balance:</span>
              <span className="text-[10px] text-stone-500">Factory Stock + Distribution Stock</span>
            </div>
            <span className="font-mono font-extrabold text-amber-950 text-base">{selectedProductStatement?.total_stock} Units</span>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-stone-800">Transaction History (Factory Movements & Pending Transfers)</h4>
            
            {selectedProductStatement?.transactions?.length === 0 ? (
              <p className="text-stone-400 text-center py-6">No transaction history recorded yet.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {selectedProductStatement?.transactions?.map((tx: any, idx: number) => {
                  const isPending = tx.isPending;
                  const isIn = tx.type === 'IN';
                  return (
                    <div key={idx} className={`p-3 rounded-xl border flex justify-between items-center ${isPending ? 'bg-amber-50/60 border-amber-300' : 'bg-white border-stone-200'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-xl flex items-center justify-center font-bold ${
                          isPending ? 'bg-amber-100 text-amber-800' : (isIn ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')
                        }`}>
                          {isPending ? <Clock className="h-4 w-4" /> : (isIn ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase ${
                              isPending ? 'bg-amber-200 text-amber-900' : (isIn ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800')
                            }`}>{tx.type}</span>
                            <span className="font-bold text-stone-900">{tx.reference}</span>
                          </div>
                          <span className="text-[10px] text-stone-500 block mt-0.5">{tx.date} | Note: {tx.notes}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`font-mono font-bold text-sm ${isPending ? 'text-amber-700' : (isIn ? 'text-emerald-700' : 'text-red-600')}`}>
                          {isIn ? `+${tx.qty}` : `-${tx.qty}`}
                        </span>
                        <span className="text-[10px] text-stone-400 block">{isPending ? 'Pending Accept' : 'Units'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t">
            <Button variant="secondary" onClick={() => setStatementModalOpen(false)}>Close Statement</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}