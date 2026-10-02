import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Boxes, PlusCircle, FileText, X, Calendar, ArrowUpRight, Edit3, Trash2, ShieldCheck, Lock, Users, Truck, Calendar as CalendarIcon, Save, Sparkles, Layers, ShoppingCart, Flame, Clock, AlertTriangle, ClipboardPlus, AlertCircle, Eye } from 'lucide-react';
import { formatLKR } from '../lib/format';
import { Card, Button, Spinner } from '../components/ui';

export default function ProductionPlanning() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'suppliers'>('inventory');
  
  const [goods, setGoods] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [prodCosts, setProdCosts] = useState<any[]>([]);
  const [pkgCosts, setPkgCosts] = useState<any[]>([]);
  const [totalAvailableStock, setTotalAvailableStock] = useState<{ [goodId: string]: number }>({});
  const [rawMaterialsStock, setRawMaterialsStock] = useState<{ [matId: string]: number }>({});

  const [selectedModalReport, setSelectedModalReport] = useState<any | null>(null);

  const getTodayLocalDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getSavedStartDate = () => {
    const saved = localStorage.getItem('bakery_plan_start_date');
    const today = getTodayLocalDate();
    return saved && saved >= today ? saved : today;
  };

  const [startDate, setStartDate] = useState<string>(getSavedStartDate());

  useEffect(() => {
    if (startDate) {
      localStorage.setItem('bakery_plan_start_date', startDate);
    }
  }, [startDate]);
  
  const [planMatrix, setPlanMatrix] = useState<{ [date: string]: { [goodId: string]: number } }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingBatch, setGeneratingBatch] = useState(false);

  const datesList = useMemo(() => {
    const list = [];
    const validStartDate = startDate ? startDate : getTodayLocalDate();
    const start = new Date(validStartDate + 'T00:00:00');
    
    for (let i = 0; i < 10; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      list.push(`${year}-${month}-${day}`);
    }
    return list;
  }, [startDate]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const goodsRes = await supabase.from('bakery_goods').select('*');
      const batchesRes = await supabase.from('bakery_finished_goods_batches').select('*');
      
      let stockOutData: any[] = [];
      try {
        const stockOutRes = await supabase.from('bakery_finished_goods_stock_out').select('*');
        stockOutData = stockOutRes.data || [];
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

      let mResData: any[] = [];
      try { const res = await supabase.from('bakery_raw_materials').select('*'); mResData = res.data || []; } catch(e) {}

      let rResData: any[] = [];
      try { const res = await supabase.from('bakery_recipes').select('*'); rResData = res.data || []; } catch(e) {}

      let pResData: any[] = [];
      try { const res = await supabase.from('bakery_production_costs').select('*'); pResData = res.data || []; } catch(e) {}

      let pkResData: any[] = [];
      try { const res = await supabase.from('bakery_packaging_costs').select('*'); pkResData = res.data || []; } catch(e) {}

      let planResData: any[] = [];
      try { const res = await supabase.from('bakery_production_plans').select('*'); planResData = res.data || []; } catch(e) {}

      let invResData: any[] = [];
      try { 
        const res = await supabase.from('bakery_inventory').select('*'); 
        invResData = res.data || []; 
      } catch(e) {
        invResData = mResData;
      }

      const goodsList = goodsRes.data || [];
      setGoods(goodsList);
      setMaterials(mResData);
      setRecipes(rResData);
      setProdCosts(pResData);
      setPkgCosts(pkResData);

      const finishedBatches = batchesRes.data || [];

      const distStockMap = new Map();
      productsData.forEach((p: any) => {
        const rawName = p.product_name || p.name || '';
        const pName = String(rawName).trim().toLowerCase();
        const q = Number(p.stock || 0);

        if (pName) {
          distStockMap.set(pName, (distStockMap.get(pName) || 0) + q);
        }
      });

      const factoryMap = new Map();
      finishedBatches.forEach((b: any) => {
        const units = Number(b.remaining_quantity || b.initial_quantity || 0);
        const goodId = String(b.good_id).trim();

        if (!factoryMap.has(goodId)) {
          factoryMap.set(goodId, { total_factory_stock: 0 });
        }
        factoryMap.get(goodId).total_factory_stock += units;
      });

      stockOutData.forEach((out: any) => {
        const goodId = String(out.good_id).trim();
        const qtyOut = Number(out.quantity_out || 0);
        if (factoryMap.has(goodId) && qtyOut > 0) {
          factoryMap.get(goodId).total_factory_stock -= qtyOut;
        }
      });

      const stockMap: { [goodId: string]: number } = {};
      goodsList.forEach((g: any) => {
        const gIdStr = String(g.good_id || g.id).trim();
        const productName = String(g.product_name || 'Product').trim();
        const nameKey = productName.toLowerCase();

        const fData = factoryMap.get(gIdStr) || { total_factory_stock: 0 };
        const factoryStock = Math.max(0, fData.total_factory_stock);
        const distStock = distStockMap.get(nameKey) || 0;

        const totalStock = factoryStock + distStock;
        stockMap[gIdStr] = totalStock;
        if (g.good_id) stockMap[String(g.good_id)] = totalStock;
        if (g.id) stockMap[String(g.id)] = totalStock;
      });

      setTotalAvailableStock(stockMap);

      const rmMap: { [matId: string]: number } = {};
      const rawMatData = invResData.length > 0 ? invResData : mResData;
      rawMatData.forEach((item: any) => {
        const mId = String(item.material_id || item.id);
        const qty = Number(item.current_stock ?? item.quantity ?? 0);
        rmMap[mId] = qty;
      });
      setRawMaterialsStock(rmMap);

      const matrix: { [date: string]: { [goodId: string]: number } } = {};
      planResData.forEach((item: any) => {
        const dStr = item.plan_date;
        const gId = String(item.good_id);
        const units = Number(item.planned_units) || 0;
        
        if (dStr && gId) {
          if (!matrix[dStr]) matrix[dStr] = {};
          matrix[dStr][gId] = units;
        }
      });
      setPlanMatrix(matrix);
    } catch (err) {
      console.error('Error fetching planning data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const matMap = useMemo(() => new Map(materials.map((m) => [String(m.id || m.material_id), m])), [materials]);
  const recipeMap = useMemo(() => {
    const map = new Map<string, any[]>();
    recipes.forEach(r => {
      const gId = String(r.good_id);
      if (!map.has(gId)) map.set(gId, []);
      map.get(gId)!.push(r);
    });
    return map;
  }, [recipes]);

  const prodCostMap = useMemo(() => new Map(prodCosts.map(p => [String(p.good_id), p])), [prodCosts]);

  const handleQtyChange = (dateStr: string, goodId: string, val: string) => {
    const num = val === '' ? 0 : Math.max(0, parseFloat(val) || 0);
    setPlanMatrix(prev => ({
      ...prev,
      [dateStr]: {
        ...(prev[dateStr] || {}),
        [goodId]: num
      }
    }));
  };

  const handleSavePlan = async () => {
    setSaving(true);
    try {
      const { data: existingPlans, error: fetchErr } = await supabase
        .from('bakery_production_plans')
        .select('*')
        .in('plan_date', datesList);

      if (fetchErr) throw fetchErr;

      const existingMap = new Map();
      (existingPlans || []).forEach((p: any) => {
        existingMap.set(`${p.plan_date}_${p.good_id}`, p.id);
      });

      const upsertRows: any[] = [];
      const idsToDelete: number[] = [];

      Object.entries(planMatrix).forEach(([dateStr, goodsMap]) => {
        Object.entries(goodsMap).forEach(([goodId, units]) => {
          const numUnits = Number(units) || 0;
          const parsedGoodId = isNaN(Number(goodId)) ? goodId : Number(goodId);

          if (numUnits > 0) {
            upsertRows.push({
              plan_date: String(dateStr),
              good_id: parsedGoodId,
              planned_units: numUnits
            });
          } else {
            const existingId = existingMap.get(`${dateStr}_${parsedGoodId}`);
            if (existingId) {
              idsToDelete.push(existingId);
            }
          }
        });
      });

      if (upsertRows.length > 0) {
        const { error: upsertErr } = await supabase
          .from('bakery_production_plans')
          .upsert(upsertRows, { onConflict: 'plan_date,good_id' });

        if (upsertErr) throw upsertErr;
      }

      if (idsToDelete.length > 0) {
        const { error: delErr } = await supabase
          .from('bakery_production_plans')
          .delete()
          .in('id', idsToDelete);

        if (delErr) throw delErr;
      }

      alert('Production plan saved successfully!');
      fetchAll();
    } catch (err: any) {
      console.error('Save plan error:', err);
      alert('Error saving plan: ' + (err.message || JSON.stringify(err)));
    }
    setSaving(false);
  };

  // DAILY REPORTS WITH CONSOLIDATED PRODUCT-WISE LABOR & BATCH BREAKDOWN (EXCLUDING PACKAGING)
  const dailyReports = useMemo(() => {
    const productionByDate = new Map<string, {
      totalUnitsDay: number;
      totalNetUnitsDay: number;
      totalPacketsDay: number;
      totalMatCost: number;
      totalWagesCost: number;
      totalGasCost: number;
      rawMaterialsNeeded: Map<string, { name: string; quantity: number; unit: string; cost: number; currentStock: number; netShortage: number }>;
      bakersNeededSum: number;
      helpersNeededSum: number;
      scheduledSales: { productName: string; saleDate: string; inputQty: number; unitType: string; grossUnits: number; netUnits: number; stockUsed: number; leadTime: number; isLeadTimeViolation: boolean }[];
      productNetUnits: Map<string, number>;
    }>();

    datesList.forEach(dStr => {
      productionByDate.set(dStr, {
        totalUnitsDay: 0,
        totalNetUnitsDay: 0,
        totalPacketsDay: 0,
        totalMatCost: 0,
        totalWagesCost: 0,
        totalGasCost: 0,
        rawMaterialsNeeded: new Map(),
        bakersNeededSum: 0,
        helpersNeededSum: 0,
        scheduledSales: [],
        productNetUnits: new Map()
      });
    });

    const activeStartDate = datesList[0];

    goods.forEach(product => {
      const goodId = String(product.good_id || product.id).trim();
      const leadTime = Number(product.lead_time_days) || 0;
      const defaultUnits = Number(product.units_per_batch) || 10000;
      const defaultPackets = Number(product.packets_per_batch) || 100;
      const unitLabel = product.unit || product.unit_type || product.measurement_unit || 'Pkts';

      let currentStockTracker = totalAvailableStock[goodId] || 0;

      datesList.forEach(saleDateStr => {
        const goodsMap = planMatrix[saleDateStr];
        if (!goodsMap) return;

        const inputVal = Number(goodsMap[goodId] || goodsMap[String(product.good_id)] || 0);
        if (inputVal <= 0) return;

        const stockUsed = Math.min(currentStockTracker, inputVal);
        currentStockTracker = Math.max(0, currentStockTracker - stockUsed);

        const netNeed = Math.max(0, inputVal - stockUsed);
        const netUnits = netNeed;
        const grossUnits = inputVal;
        const stockUsedUnits = stockUsed;

        const saleDateObj = new Date(saleDateStr + 'T00:00:00');
        saleDateObj.setDate(saleDateObj.getDate() - leadTime);
        const y = saleDateObj.getFullYear();
        const m = String(saleDateObj.getMonth() + 1).padStart(2, '0');
        const day = String(saleDateObj.getDate()).padStart(2, '0');
        let prodDateStr = `${y}-${m}-${day}`;

        const isLeadTimeViolation = prodDateStr < activeStartDate && netUnits > 0;

        if (prodDateStr < activeStartDate) {
          prodDateStr = activeStartDate;
        }

        if (productionByDate.has(prodDateStr)) {
          let dayReport = productionByDate.get(prodDateStr)!;

          dayReport.totalUnitsDay += grossUnits;
          dayReport.totalNetUnitsDay += netUnits;

          dayReport.scheduledSales.push({
            productName: product.product_name || 'Item',
            saleDate: saleDateStr,
            inputQty: inputVal,
            unitType: unitLabel,
            grossUnits,
            netUnits,
            stockUsed: stockUsedUnits,
            leadTime,
            isLeadTimeViolation
          });

          if (netUnits <= 0) return;

          const existingProd = dayReport.productNetUnits.get(goodId) || 0;
          dayReport.productNetUnits.set(goodId, existingProd + netUnits);
          dayReport.totalPacketsDay += netUnits;
        }
      });
    });

    return datesList.map((dateStr, idx) => {
      const rep = productionByDate.get(dateStr)!;

      let totalDayMatCost = 0;
      let totalDayWagesCost = 0;
      let totalDayGasCost = 0;
      let bakersNeededSum = 0;
      let helpersNeededSum = 0;

      const itemLaborBreakdown: any[] = [];

      rep.productNetUnits.forEach((totalNetUnits, goodId) => {
        const product = goods.find(g => String(g.good_id || g.id) === goodId);
        if (!product) return;

        const defaultUnits = Number(product.units_per_batch) || 10000;
        const numBatches = defaultUnits > 0 ? Math.ceil(totalNetUnits / defaultUnits) : 1;

        const itemRecipes = recipeMap.get(goodId) || recipeMap.get(String(product.good_id)) || [];
        let primaryMatText = '';
        itemRecipes.forEach(r => {
          const mat = matMap.get(String(r.raw_material_id));
          if (mat) {
            const mName = (mat.name || mat.material_name || '').toLowerCase();
            if (mName.includes('flour') || mName.includes('පිටි') || mName.includes('maida')) {
              const singleBatchMatQty = Number(r.quantity_per_batch) || 0;
              primaryMatText = `${singleBatchMatQty} ${mat.unit || 'Kg'} ${mat.name || mat.material_name}`;
            }
          }
        });
        if (!primaryMatText && itemRecipes.length > 0) {
          const firstR = itemRecipes[0];
          const mat = matMap.get(String(firstR.raw_material_id));
          if (mat) {
            primaryMatText = `${firstR.quantity_per_batch} ${mat.unit || 'Kg'} ${mat.name || mat.material_name}`;
          }
        }

        const batchSizeDisplay = primaryMatText ? `${defaultUnits} Units / ${primaryMatText}` : `${defaultUnits} Units`;

        // 1. Material Cost
        itemRecipes.forEach(r => {
          const mat = matMap.get(String(r.raw_material_id));
          if (!mat) return;
          const reqQty = (Number(r.quantity_per_batch) || 0) * numBatches;
          const reqCost = reqQty * (Number(mat.unit_cost) || 0);
          totalDayMatCost += reqCost;

          const mId = String(mat.material_id || mat.id);
          const currentMatStock = rawMaterialsStock[mId] || 0;

          const existing = rep.rawMaterialsNeeded.get(mId);
          if (existing) {
            existing.quantity += reqQty;
            existing.cost += reqCost;
            existing.netShortage = Math.max(0, existing.quantity - currentMatStock);
          } else {
            rep.rawMaterialsNeeded.set(mId, {
              name: mat.name || mat.material_name,
              quantity: reqQty,
              unit: mat.unit || 'Kg',
              cost: reqCost,
              currentStock: currentMatStock,
              netShortage: Math.max(0, reqQty - currentMatStock)
            });
          }
        });

        // 2. Production Costs (Wages & Gas)
        const pCost = prodCostMap.get(goodId) || prodCostMap.get(String(product.good_id));
        let laborCostPerBatch = 0;
        let itemLaborCost = 0;
        let itemGasCost = 0;

        if (pCost) {
          const bakerDaily = Number(pCost.baker_daily_wage) || 0;
          const bakerUnitsPerDay = Number(pCost.baker_units_per_day) || 10000;
          const helperDaily = Number(pCost.helper_daily_wage) || 0;
          const gasBatch = Number(pCost.gas_cost) || 0;

          const laborCostPerUnit = bakerUnitsPerDay > 0 ? (bakerDaily + helperDaily) / bakerUnitsPerDay : 0;
          laborCostPerBatch = laborCostPerUnit * defaultUnits;
          itemLaborCost = laborCostPerBatch * numBatches;

          itemGasCost = gasBatch * numBatches;

          totalDayWagesCost += itemLaborCost;
          totalDayGasCost += itemGasCost;

          bakersNeededSum += totalNetUnits / bakerUnitsPerDay;
          helpersNeededSum += totalNetUnits / bakerUnitsPerDay;
        }

        itemLaborBreakdown.push({
          productName: product.product_name || 'Item',
          netUnits: totalNetUnits,
          batchSizeDisplay,
          numBatches,
          laborCostPerBatch,
          totalItemLaborCost: itemLaborCost,
          totalItemGasCost: itemGasCost
        });
      });

      rep.totalMatCost = totalDayMatCost;
      rep.totalWagesCost = totalDayWagesCost;
      rep.totalGasCost = totalDayGasCost;

      const bakersCount = Math.ceil(bakersNeededSum || (rep.totalNetUnitsDay > 0 ? 1 : 0));
      const helpersCount = Math.ceil(helpersNeededSum || (rep.totalNetUnitsDay > 0 ? 1 : 0));

      let has3DayShortage = false;
      if (idx < datesList.length - 2) {
        const windowDates = [datesList[idx], datesList[idx+1], datesList[idx+2]];
        windowDates.forEach(wDate => {
          const wRep = productionByDate.get(wDate);
          if (wRep) {
            wRep.rawMaterialsNeeded.forEach(rm => {
              if (rm.netShortage > 0) has3DayShortage = true;
            });
          }
        });
      }

      const MAX_DAILY_UNIT_CAPACITY = 40000;
      const isCapacityExceeded = rep.totalNetUnitsDay > MAX_DAILY_UNIT_CAPACITY;

      // EXCLUDING PACKAGING FROM BATCH COST TOTAL
      const totalDayCost = rep.totalMatCost + rep.totalWagesCost + rep.totalGasCost;
      const wagesPercentage = totalDayCost > 0 ? (rep.totalWagesCost / totalDayCost) * 100 : 0;

      return {
        dateStr,
        ...rep,
        totalDayCost,
        wagesPercentage,
        rawMaterials: Array.from(rep.rawMaterialsNeeded.values()),
        itemLaborBreakdown,
        has3DayShortage,
        isCapacityExceeded,
        labor: {
          bakers: bakersCount,
          helpers: helpersCount,
          packers: Math.ceil(rep.totalPacketsDay > 0 ? 1 : 0)
        }
      };
    });
  }, [datesList, planMatrix, goods, recipeMap, matMap, prodCostMap, totalAvailableStock, startDate]);

  const handleGenerateBatchCards = async () => {
    setGeneratingBatch(true);
    try {
      const todayStr = getTodayLocalDate();
      let targetReport = dailyReports.find(r => r.dateStr >= todayStr && r.totalNetUnitsDay > 0);
      
      if (!targetReport) {
        targetReport = dailyReports.find(r => r.totalNetUnitsDay > 0);
      }

      if (!targetReport || targetReport.productNetUnits.size === 0) {
        alert('No upcoming production units planned in the schedule. Please enter quantities in the target matrix and save first.');
        setGeneratingBatch(false);
        return;
      }

      const targetDateStr = targetReport.dateStr;
      const batchRows: any[] = [];
      let idx = 0;

      targetReport.productNetUnits.forEach((units, goodId) => {
        if (units > 0) {
          batchRows.push({
            batch_number: `BATCH-${targetDateStr.replaceAll('-', '')}-${idx + 101}`,
            good_id: parseInt(goodId),
            planned_units: units,
            status: 'Pending',
            bakers_assigned: 'General Production Team'
          });
          idx++;
        }
      });

      if (batchRows.length === 0) {
        alert('No production units found to batch for ' + targetDateStr);
        setGeneratingBatch(false);
        return;
      }

      const { error } = await supabase.from('bakery_batch_cards').insert(batchRows);
      if (error) throw error;

      alert(`Successfully generated ${batchRows.length} Batch Cards for production date (${targetDateStr})!`);
    } catch (err: any) {
      alert('Error generating batch cards: ' + err.message);
    }
    setGeneratingBatch(false);
  };

  const grandTotal10Days = useMemo(() => {
    return dailyReports.reduce((acc, curr) => ({
      units: acc.units + curr.totalNetUnitsDay,
      packets: acc.packets + curr.totalPacketsDay,
      cost: acc.cost + curr.totalDayCost,
      wagesCost: acc.wagesCost + curr.totalWagesCost
    }), { units: 0, packets: 0, cost: 0, wagesCost: 0 });
  }, [dailyReports]);

  const overallWagesPercentage = grandTotal10Days.cost > 0 ? (grandTotal10Days.wagesCost / grandTotal10Days.cost) * 100 : 0;

  if (loading) return <Spinner />;

  return (
    <div className="space-y-8 pb-12">
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">10-Day Production Planning & Requirements</h1>
          <p className="text-xs text-stone-500 mt-0.5">Considers Combined Stock (Factory Batches + Distribution Stock) and provides 3-day advance Raw Material shortage alerts.</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <div className="flex items-center gap-2 bg-stone-50 border border-stone-300 px-3 py-2 rounded-xl">
            <CalendarIcon className="h-4 w-4 text-stone-600" />
            <span className="text-xs font-bold text-stone-700">Target Date:</span>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-stone-900 focus:outline-none"
            />
          </div>

          <Button onClick={handleSavePlan} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white text-xs flex items-center gap-1.5">
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Plan'}
          </Button>

          <Button onClick={handleGenerateBatchCards} disabled={generatingBatch} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center gap-1.5">
            <ClipboardPlus className="h-4 w-4" /> {generatingBatch ? 'Generating...' : 'Generate Batch Cards (Auto-Nearest)'}
          </Button>
        </div>
      </div>

      <Card className="p-5 overflow-x-auto">
        <h3 className="font-bold text-stone-800 text-sm mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4 text-amber-600" /> Sales / Distribution Target Matrix (Packets / Units)
        </h3>

        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-stone-900 text-white font-mono">
              <th className="p-3 text-left sticky left-0 bg-stone-900 z-10">Product Name (Code)</th>
              {datesList.map(dateStr => {
                const d = new Date(dateStr + 'T00:00:00');
                const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                return (
                  <th key={dateStr} className="p-3 text-center border-l border-stone-800 min-w-[90px]">
                    <div>{dayName}</div>
                    <div className="text-[10px] text-amber-400">{dateStr.slice(5)}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {goods.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-8 text-center text-stone-400">No products found in bakery_goods table.</td>
              </tr>
            ) : (
              goods.map(g => {
                const gId = String(g.good_id || g.id);
                const code = g.product_code || '';
                const name = g.product_name || 'Item';
                const availStock = totalAvailableStock[gId] || 0;
                const unitLabel = g.unit || g.unit_type || g.measurement_unit || 'Pkts';
                const leadTime = Number(g.lead_time_days) || 0;

                return (
                  <tr key={gId} className="hover:bg-stone-50">
                    <td className="p-3 font-bold text-stone-800 sticky left-0 bg-white z-10 border-r shadow-sm">
                      <div className="flex flex-col gap-1">
                        <span>{code ? `${code} — ${name}` : name}</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-purple-100 text-purple-700 uppercase">
                            {unitLabel} (Lead: {leadTime}d)
                          </span>
                          {availStock > 0 && (
                            <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-mono font-bold" title="Combined Stock">
                              Stock: {Math.round(availStock)}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    {datesList.map(dateStr => {
                      const val = planMatrix[dateStr]?.[gId] || '';

                      return (
                        <td key={dateStr} className="p-2 text-center border-l border-stone-100">
                          <input 
                            type="number"
                            min="0"
                            placeholder={unitLabel}
                            value={val === 0 ? '' : val}
                            onChange={(e) => handleQtyChange(dateStr, gId, e.target.value)}
                            className="w-full text-center border rounded-lg py-1.5 font-mono font-bold text-xs bg-stone-50 border-stone-200 text-stone-800 focus:bg-white focus:border-amber-600 focus:outline-none"
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      <div className="bg-stone-900 text-white p-6 rounded-2xl flex flex-wrap justify-between items-center gap-6 shadow-xl">
        <div>
          <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> 10-Day Net Production Summary (After Combined Stock Deduction)
          </h2>
          <p className="text-xs text-stone-300 mt-1">Total projected net output and expenses across the selected schedule.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="bg-stone-800 px-5 py-3 rounded-xl border border-stone-700 text-center">
            <p className="text-[10px] text-stone-400 uppercase font-bold">Net Units to Bake</p>
            <p className="text-xl font-mono font-extrabold text-amber-400 mt-0.5">{Math.round(grandTotal10Days.units).toLocaleString()}</p>
          </div>
          <div className="bg-stone-800 px-5 py-3 rounded-xl border border-stone-700 text-center">
            <p className="text-[10px] text-stone-400 uppercase font-bold">Total Packets</p>
            <p className="text-xl font-mono font-extrabold text-amber-400 mt-0.5">{Math.round(grandTotal10Days.packets).toLocaleString()}</p>
          </div>
          <div className="bg-stone-800 px-5 py-3 rounded-xl border border-stone-700 text-center">
            <p className="text-[10px] text-stone-400 uppercase font-bold">Total Estimated Cost</p>
            <p className="text-xl font-mono font-extrabold text-emerald-400 mt-0.5">{formatLKR(grandTotal10Days.cost)}</p>
          </div>
          <div className="bg-stone-800 px-5 py-3 rounded-xl border border-stone-700 text-center">
            <p className="text-[10px] text-stone-400 uppercase font-bold">Wages Cost %</p>
            <p className="text-xl font-mono font-extrabold text-purple-400 mt-0.5">{overallWagesPercentage.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
          <Flame className="h-5 w-5 text-amber-600" /> Actual Production Date & Material Requirements (Batch-Wise Calculation)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {dailyReports.map((report) => {
            if (report.totalUnitsDay <= 0) return null;
            return (
              <Card key={report.dateStr} className={`p-5 space-y-4 border-l-4 ${report.has3DayShortage || report.isCapacityExceeded ? 'border-red-500 bg-red-50/20' : 'border-amber-500'}`}>
                <div className="flex justify-between items-start border-b pb-3 gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <h4 className="font-bold text-stone-900 text-base">Production Date: {report.dateStr}</h4>
                      {report.has3DayShortage && (
                        <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Material Shortage Alert
                        </span>
                      )}
                      {report.isCapacityExceeded && (
                        <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Capacity / Time Exceeded (ධාරිතාව මදි!)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 font-mono mt-0.5">
                      Net Units to Bake: <strong className="text-stone-800">{Math.round(report.totalNetUnitsDay).toLocaleString()}</strong> (Gross: {Math.round(report.totalUnitsDay)})
                    </p>
                  </div>

                  {/* BATCH COST CLEAR BREAKDOWN BADGE (WITHOUT PACKAGING) */}
                  <div className="text-right bg-amber-50 border border-amber-200 p-2.5 rounded-xl space-y-1 min-w-[180px]">
                    <div className="flex justify-between items-center text-[10px] text-stone-600 font-mono">
                      <span>Material:</span>
                      <span className="font-bold text-stone-900">{formatLKR(report.totalMatCost)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-purple-700 font-mono">
                      <span>Wages (Labor):</span>
                      <span className="font-bold">{formatLKR(report.totalWagesCost)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-amber-700 font-mono">
                      <span>Gas Cost:</span>
                      <span className="font-bold">{formatLKR(report.totalGasCost)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-mono font-extrabold text-emerald-700 border-t border-amber-300 pt-1">
                      <span>Total Cost:</span>
                      <span>{formatLKR(report.totalDayCost)}</span>
                    </div>
                    
                    <button 
                      onClick={() => setSelectedModalReport(report)}
                      className="mt-2 w-full bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold py-1 px-2 rounded-lg flex items-center justify-center gap-1 shadow-sm"
                    >
                      <Eye className="h-3 w-3" /> View Consolidated Item Breakdown
                    </button>
                  </div>
                </div>

                {report.isCapacityExceeded && (
                  <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-xs text-red-800 font-medium flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span>අවධානයයි: මෙම දින නියමිත නිෂ්පාදන ප්‍රමාණය බේකර්ස්ලාගේ සාමාන්‍ය ධාරිතාවට වඩා වැඩි බැවින්, අද දින තුළ මෙය නිම කිරීමට වෙලාව හෝ ශ්‍රමය ප්‍රමාණවත් නොවේ. කරුණාකර ඉහළින් ඇති Target Matrix එකෙන් අදාළ දිනවල ඉලක්ක ප්‍රමාණය අඩු කරන්න හෝ වෙනත් දිනකට බෙදාහරින්න.</span>
                  </div>
                )}

                <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-xs space-y-1">
                  <p className="font-bold text-amber-900 uppercase text-[10px]">Fulfils Sales Targets & Stock Allocation:</p>
                  {report.scheduledSales.map((sale, sIdx) => (
                    <div key={sIdx} className="text-stone-700 flex flex-col gap-0.5 border-b border-amber-200/50 pb-1 last:border-0">
                      <div className="flex justify-between items-center">
                        <span>• {sale.productName} ({sale.inputQty} {sale.unitType})</span>
                        <span className="font-mono text-stone-500 text-[11px]">
                          {sale.stockUsed > 0 ? `From Stock: ${Math.round(sale.stockUsed)} | ` : ''}Bake: {Math.round(sale.netUnits)} (For: {sale.saleDate})
                        </span>
                      </div>
                      {sale.isLeadTimeViolation && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-100/80 px-2 py-0.5 rounded w-fit flex items-center gap-1">
                          ⚠️ Lead Time මදි - නියමිත දිනට නිෂ්පාදනය කළ නොහැක!
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="bg-purple-50 p-3 rounded-xl border border-purple-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-bold text-purple-900">
                    <Users className="h-4 w-4 text-purple-700" /> Workforce Needed:
                  </div>
                  <div className="font-mono text-purple-950 font-semibold space-x-3">
                    <span>Bakers: {report.labor.bakers}</span>
                    <span>Helpers: {report.labor.helpers}</span>
                    <span>Packers: {report.labor.packers}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-stone-700 uppercase flex items-center gap-1.5">
                    <ShoppingCart className="h-3.5 w-3.5 text-stone-600" /> Required Raw Materials (Batch-Wise):
                  </p>
                  <div className="bg-stone-50 rounded-xl p-3 border max-h-48 overflow-y-auto">
                    {report.rawMaterials.length === 0 ? (
                      <p className="text-xs text-stone-400 italic">No net production required or no recipe materials defined.</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-stone-400 font-mono text-[10px] border-b">
                            <th className="pb-1">Material</th>
                            <th className="pb-1 text-right">Req Qty</th>
                            <th className="pb-1 text-right">Net Shortage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {report.rawMaterials.map((mat, mIdx) => (
                            <tr key={mIdx}>
                              <td className="py-1.5 text-stone-800 font-medium">{mat.name}</td>
                              <td className="py-1.5 text-right font-mono font-bold text-amber-700">{mat.quantity.toFixed(2)} {mat.unit}</td>
                              <td className={`py-1.5 text-right font-mono font-bold ${mat.netShortage > 0 ? 'text-red-600 bg-red-50 px-1 rounded' : 'text-emerald-600'}`}>
                                {mat.netShortage > 0 ? `${mat.netShortage.toFixed(2)} {mat.unit} ⚠️` : 'Available'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* CONSOLIDATED ITEM-WISE LABOR COST BREAKDOWN MODAL WITH BATCH SIZE / INGREDIENT FORMAT */}
      {selectedModalReport && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-600" /> Consolidated Labor & Batch Breakdown ({selectedModalReport.dateStr})
                </h3>
                <p className="text-xs text-stone-500">Consolidated product-wise total net units, batch sizes with primary ingredient, and labor cost.</p>
              </div>
              <button 
                onClick={() => setSelectedModalReport(null)}
                className="h-8 w-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-stone-900 text-white font-mono text-left">
                    <th className="p-2.5">Product Name</th>
                    <th className="p-2.5 text-center">Total Net Units</th>
                    <th className="p-2.5 text-center">Batch Size / Primary Material</th>
                    <th className="p-2.5 text-center">Batches</th>
                    <th className="p-2.5 text-right">Labor/Batch</th>
                    <th className="p-2.5 text-right text-purple-300">Total Labor Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-mono">
                  {selectedModalReport.itemLaborBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-stone-400">No production items for this date.</td>
                    </tr>
                  ) : (
                    selectedModalReport.itemLaborBreakdown.map((item: any, iIdx: number) => (
                      <tr key={iIdx} className="hover:bg-stone-50">
                        <td className="p-2.5 font-bold text-stone-800 font-sans">{item.productName}</td>
                        <td className="p-2.5 text-center font-bold text-stone-900">{Math.round(item.netUnits)}</td>
                        <td className="p-2.5 text-center text-amber-800 font-medium">{item.batchSizeDisplay}</td>
                        <td className="p-2.5 text-center font-bold text-amber-700">{item.numBatches}</td>
                        <td className="p-2.5 text-right text-stone-600">{formatLKR(item.laborCostPerBatch)}</td>
                        <td className="p-2.5 text-right font-bold text-purple-700">{formatLKR(item.totalItemLaborCost)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {selectedModalReport.itemLaborBreakdown.length > 0 && (
                  <tfoot>
                    <tr className="bg-stone-100 font-mono font-bold text-stone-900 border-t-2">
                      <td colSpan={5} className="p-2.5 font-sans text-right">TOTAL WAGES (LABOR):</td>
                      <td className="p-2.5 text-right text-purple-900 text-sm">{formatLKR(selectedModalReport.totalWagesCost)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setSelectedModalReport(null)} className="bg-stone-800 hover:bg-stone-900 text-white text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}