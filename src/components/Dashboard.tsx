import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Button, Spinner } from '@/components/ui';
import { LayoutDashboard, Users, Factory, Calendar, CheckCircle2, XCircle, AlertCircle, DollarSign, Percent, Layers, PieChart, Flame, AlertTriangle } from 'lucide-react';
import { formatLKR } from '@/lib/format';

export default function Dashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeBatches: 0,
    totalInventoryItems: 0,
  });
  const [productCostBreakdown, setProductCostBreakdown] = useState<any[]>([]);
  const [overallSummary, setOverallSummary] = useState({ totalCost: 0, totalWages: 0, totalGas: 0, totalMat: 0, totalPkg: 0 });
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, batchRes, leaveRes, goodsRes, recipesRes, rawMatRes, prodCostRes, pkgCostRes, planRes] = await Promise.all([
        supabase.from('bakery_employees').select('id', { count: 'exact', head: true }),
        supabase.from('bakery_batch_cards').select('id', { count: 'exact', head: true }).eq('status', 'In Progress'),
        supabase.from('bakery_leaves').select('*').order('id', { ascending: false }),
        supabase.from('bakery_goods').select('*'),
        supabase.from('bakery_recipes').select('*'),
        supabase.from('bakery_raw_materials').select('*'),
        supabase.from('bakery_production_costs').select('*'),
        supabase.from('bakery_packaging_costs').select('*'),
        supabase.from('bakery_production_plans').select('*')
      ]);

      const rawMaterials = rawMatRes.data || [];

      setStats({
        totalEmployees: empRes.count || 0,
        activeBatches: batchRes.count || 0,
        totalInventoryItems: rawMaterials.length,
      });

      const goods = goodsRes.data || [];
      const recipes = recipesRes.data || [];
      const prodCosts = prodCostRes.data || [];
      const pkgCosts = pkgCostRes.data || [];
      const plans = planRes.data || [];

      const matCostMap = new Map(rawMaterials.map(m => [String(m.id || m.material_id), Number(m.unit_cost || 0)]));
      const prodCostMap = new Map(prodCosts.map(p => [String(p.good_id), p]));
      const pkgCostMap = new Map(pkgCosts.map(pk => [String(pk.good_id), pk]));

      const recipeMap = new Map<string, any[]>();
      recipes.forEach(r => {
        const gId = String(r.good_id);
        if (!recipeMap.has(gId)) recipeMap.set(gId, []);
        recipeMap.get(gId)!.push(r);
      });

      let grandTotalCost = 0;
      let grandTotalWages = 0;
      let grandTotalGas = 0;
      let grandTotalMat = 0;
      let grandTotalPkg = 0;

      const breakdown = goods.map(prod => {
        const gId = String(prod.good_id || prod.id);
        const prodName = prod.product_name || prod.name || 'Product';
        const defaultUnits = Number(prod.units_per_batch) || 10000;
        const defaultPackets = Number(prod.packets_per_batch) || 100;

        let batchMatCost = 0;
        const itemRecipes = recipeMap.get(gId) || [];
        itemRecipes.forEach(r => {
          const uCost = matCostMap.get(String(r.raw_material_id)) || 0;
          batchMatCost += (Number(r.quantity_per_batch) || 0) * uCost;
        });

        let batchWagesCost = 0;
        let batchGasCost = 0;
        const pCost = prodCostMap.get(gId);
        if (pCost) {
          const bDaily = Number(pCost.baker_daily_wage) || 0;
          const bUnitsPerDay = Number(pCost.baker_units_per_day) || 10000;
          const hDaily = Number(pCost.helper_daily_wage) || 0;
          batchGasCost = Number(pCost.gas_cost) || 0;

          const laborCostPerUnit = bUnitsPerDay > 0 ? (bDaily + hDaily) / bUnitsPerDay : 0;
          batchWagesCost = laborCostPerUnit * defaultUnits;
        }

        let batchPkgCost = 0;
        const pkCost = pkgCostMap.get(gId);
        if (pkCost) {
          const polyPkt = Number(pkCost.polythene_cost_per_packet) || 0;
          const labelPkt = Number(pkCost.label_cost_per_packet) || 0;
          const packerDaily = Number(pkCost.packer_daily_wage) || 0;
          const pktsPerDay = Number(pkCost.packets_per_day) || 100;
          const packerPerPkt = pktsPerDay > 0 ? packerDaily / pktsPerDay : 0;
          
          const totalPktCost = polyPkt + labelPkt + packerPerPkt;
          batchPkgCost = totalPktCost * defaultPackets;
        }

        const totalBatchCost = batchMatCost + batchWagesCost + batchGasCost + batchPkgCost;
        const wagesPercentage = totalBatchCost > 0 ? (batchWagesCost / totalBatchCost) * 100 : 0;

        grandTotalCost += totalBatchCost;
        grandTotalWages += batchWagesCost;
        grandTotalGas += batchGasCost;
        grandTotalMat += batchMatCost;
        grandTotalPkg += batchPkgCost;

        return {
          productName: prodName,
          unit: prod.unit || 'Units',
          batchMatCost,
          batchWagesCost,
          batchGasCost,
          batchPkgCost,
          totalBatchCost,
          wagesPercentage
        };
      });

      setProductCostBreakdown(breakdown);
      setOverallSummary({
        totalCost: grandTotalCost,
        totalWages: grandTotalWages,
        totalGas: grandTotalGas,
        totalMat: grandTotalMat,
        totalPkg: grandTotalPkg
      });

      // --- CALCULATE 5-DAY RAW MATERIAL REQUIREMENT ---
      const todayStr = new Date().toISOString().split('T')[0];
      const futureDateObj = new Date();
      futureDateObj.setDate(futureDateObj.getDate() + 5);
      const futureStr = futureDateObj.toISOString().split('T')[0];

      const upcomingPlans = plans.filter(p => p.plan_date >= todayStr && p.plan_date <= futureStr);

      const requiredMaterialsMap = new Map<string, number>();
      upcomingPlans.forEach(plan => {
        const gId = String(plan.good_id);
        const plannedUnits = Number(plan.planned_units) || 0;
        const prod = goods.find(g => String(g.good_id || g.id) === gId);
        const defaultUnits = Number(prod?.units_per_batch) || 10000;
        const numBatches = defaultUnits > 0 ? Math.ceil(plannedUnits / defaultUnits) : 1;

        const itemRecipes = recipeMap.get(gId) || [];
        itemRecipes.forEach(r => {
          const matId = String(r.raw_material_id);
          const reqQty = (Number(r.quantity_per_batch) || 0) * numBatches;
          requiredMaterialsMap.set(matId, (requiredMaterialsMap.get(matId) || 0) + reqQty);
        });
      });

      const stockAlertsList: any[] = [];
      rawMaterials.forEach(m => {
        const matId = String(m.id || m.material_id);
        const currentStock = Number(m.current_stock ?? m.quantity ?? m.stock ?? 0);
        
        // Using buffer_stock_level as requested
        const bufferLimit = Number(m.buffer_stock_level ?? m.buffer_limit ?? m.min_stock_level ?? m.minimum_stock ?? 0);
        const requiredFor5Days = requiredMaterialsMap.get(matId) || 0;

        const isBelowBuffer = bufferLimit > 0 && currentStock < bufferLimit;
        const isBelowProductionReq = currentStock < requiredFor5Days;
        const productionShortage = isBelowProductionReq ? requiredFor5Days - currentStock : 0;

        if (isBelowBuffer || isBelowProductionReq) {
          stockAlertsList.push({
            id: matId,
            name: m.name || m.material_name || 'Material',
            currentStock,
            bufferLimit,
            requiredFor5Days,
            isBelowBuffer,
            productionShortage,
            unit: m.unit || 'Kg'
          });
        }
      });

      setLowStockAlerts(stockAlertsList);

      const allLeaves = leaveRes.data || [];
      const pend = allLeaves.filter(l => !l.status || l.status.toLowerCase() === 'pending');
      setPendingLeaves(pend);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleApproveLeave = async (leaveId: number) => {
    try {
      const { error } = await supabase.from('bakery_leaves').update({ status: 'Approved' }).eq('id', leaveId);
      if (error) throw error;
      alert('Leave request approved successfully!');
      fetchDashboardData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleRejectLeave = async (leaveId: number) => {
    try {
      const { error } = await supabase.from('bakery_leaves').update({ status: 'Rejected' }).eq('id', leaveId);
      if (error) throw error;
      alert('Leave request rejected.');
      fetchDashboardData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const overallWagesPercentage = overallSummary.totalCost > 0 ? (overallSummary.totalWages / overallSummary.totalCost) * 100 : 0;

  if (loading) return <Spinner />;

  return (
    <div className="space-y-8 pb-12">
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-amber-600" /> Dashboard Overview
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">Bakery overall production, staff, recipe cost breakdown, and leave management.</p>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => onNavigate('employees')} className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
            Staff Management
          </Button>
          <Button onClick={() => onNavigate('batches')} variant="secondary" className="text-xs">
            Batch Cards
          </Button>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-3 border-l-4 border-amber-500">
          <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-stone-400 block uppercase font-bold">Employees</span>
            <span className="text-xl font-bold text-stone-900">{stats.totalEmployees}</span>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3 border-l-4 border-blue-500">
          <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            <Factory className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-stone-400 block uppercase font-bold">Active Batches</span>
            <span className="text-xl font-bold text-stone-900">{stats.activeBatches}</span>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3 border-l-4 border-purple-500">
          <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
            <Percent className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-stone-400 block uppercase font-bold">Overall Wages %</span>
            <span className="text-xl font-bold text-purple-700 font-mono">{overallWagesPercentage.toFixed(1)}%</span>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3 border-l-4 border-emerald-600">
          <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-stone-400 block uppercase font-bold">Total Batch Cost</span>
            <span className="text-sm font-bold text-stone-900 font-mono">{formatLKR(overallSummary.totalCost)}</span>
          </div>
        </Card>
      </div>

      {/* LOW STOCK & BUFFER / REQUIREMENT ALERTS SECTION */}
      <div className={`p-6 rounded-2xl border shadow-sm space-y-4 ${lowStockAlerts.length > 0 ? 'bg-red-50/40 border-red-300' : 'bg-white border-stone-200'}`}>
        <h2 className="text-lg font-bold text-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-6 w-6 text-red-600 ${lowStockAlerts.length > 0 ? 'animate-bounce' : ''}`} /> 
            <span>Low Stock, Buffer Limit & 5-Day Requirement Alerts</span>
          </div>
          {lowStockAlerts.length > 0 && (
            <span className="bg-red-600 text-white text-xs px-3 py-1 rounded-full font-bold animate-pulse shadow-sm">
              ⚠️ {lowStockAlerts.length} Alerts Active!
            </span>
          )}
        </h2>

        {lowStockAlerts.length === 0 ? (
          <div className="py-8 text-center text-emerald-600 text-xs border border-dashed rounded-xl font-medium bg-emerald-50/50">
            All raw material stocks are sufficient above buffer limits and upcoming 5-day production plans!
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-xl border border-red-200 p-2 shadow-inner">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-stone-900 text-white font-mono text-left">
                  <th className="p-3">Raw Material Name</th>
                  <th className="p-3 text-right">Current Stock</th>
                  <th className="p-3 text-right">Buffer Limit</th>
                  <th className="p-3 text-right">5-Day Required</th>
                  <th className="p-3 text-center text-amber-300">Buffer Status</th>
                  <th className="p-3 text-right text-red-400">Production Shortage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-mono">
                {lowStockAlerts.map((item, idx) => (
                  <tr key={idx} className="hover:bg-red-50/50">
                    <td className="p-3 font-bold text-stone-900 font-sans">{item.name}</td>
                    <td className="p-3 text-right text-stone-700">{item.currentStock.toFixed(2)} {item.unit}</td>
                    <td className="p-3 text-right text-stone-500">{item.bufferLimit > 0 ? `${item.bufferLimit.toFixed(2)} ${item.unit}` : 'Not Set'}</td>
                    <td className="p-3 text-right text-amber-700">{item.requiredFor5Days.toFixed(2)} {item.unit}</td>
                    <td className="p-3 text-center font-bold">
                      {item.isBelowBuffer ? (
                        <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-[10px] animate-pulse">
                          ⚠️ Buffer Stock නැත
                        </span>
                      ) : (
                        <span className="text-emerald-600">OK</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-bold text-red-600 bg-red-50">
                      {item.productionShortage > 0 ? `${item.productionShortage.toFixed(2)} {item.unit} ⚠️` : 'OK'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PRODUCT-BY-PRODUCT COST & WAGES PERCENTAGE BREAKDOWN */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-amber-600" /> Product-wise Cost Breakdown (Recipe, Wages & Gas Separated)
          </h2>
          <span className="text-xs font-mono text-stone-500">Based on standard batch quantities</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-stone-900 text-white font-mono text-left">
                <th className="p-3">Product Name</th>
                <th className="p-3 text-right">Material Cost</th>
                <th className="p-3 text-right">Wages (Labor)</th>
                <th className="p-3 text-right">Gas Cost</th>
                <th className="p-3 text-right">Packaging Cost</th>
                <th className="p-3 text-right">Total Cost</th>
                <th className="p-3 text-right text-amber-400">Wages Cost %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {productCostBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-stone-400">No products or recipe costs found.</td>
                </tr>
              ) : (
                productCostBreakdown.map((item, idx) => (
                  <tr key={idx} className="hover:bg-stone-50 font-mono">
                    <td className="p-3 font-bold text-stone-800 font-sans">{item.productName}</td>
                    <td className="p-3 text-right text-stone-600">{formatLKR(item.batchMatCost)}</td>
                    <td className="p-3 text-right text-purple-700 font-bold">{formatLKR(item.batchWagesCost)}</td>
                    <td className="p-3 text-right text-amber-700">{formatLKR(item.batchGasCost)}</td>
                    <td className="p-3 text-right text-stone-600">{formatLKR(item.batchPkgCost)}</td>
                    <td className="p-3 text-right text-stone-900 font-bold">{formatLKR(item.totalBatchCost)}</td>
                    <td className="p-3 text-right font-extrabold text-amber-600">{item.wagesPercentage.toFixed(1)}%</td>
                  </tr>
                ))
              )}
            </tbody>
            {productCostBreakdown.length > 0 && (
              <tfoot>
                <tr className="bg-stone-100 font-mono font-bold text-stone-900 border-t-2 border-stone-300">
                  <td className="p-3 font-sans">GRAND TOTAL</td>
                  <td className="p-3 text-right">{formatLKR(overallSummary.totalMat)}</td>
                  <td className="p-3 text-right text-purple-800">{formatLKR(overallSummary.totalWages)}</td>
                  <td className="p-3 text-right text-amber-800">{formatLKR(overallSummary.totalGas)}</td>
                  <td className="p-3 text-right">{formatLKR(overallSummary.totalPkg)}</td>
                  <td className="p-3 text-right">{formatLKR(overallSummary.totalCost)}</td>
                  <td className="p-3 text-right text-amber-700 text-sm">{overallWagesPercentage.toFixed(1)}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* PENDING LEAVE REQUESTS SECTION */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600" /> Staff Leave Requests (Pending)
        </h2>

        {pendingLeaves.length === 0 ? (
          <div className="py-8 text-center text-stone-400 text-xs border border-dashed rounded-xl">
            No pending leave requests found.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingLeaves.map((leave) => (
              <table key={leave.id} className="w-full">
                <tbody>
                  <tr className="p-4 rounded-xl border border-stone-200 bg-stone-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
                    <td className="space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-stone-900 text-sm">{leave.employee_name}</strong>
                        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold text-[10px]">Date: {leave.leave_date}</span>
                      </div>
                      <p className="text-stone-600">Reason: <span className="font-medium text-stone-800">{leave.reason}</span></p>
                    </td>

                    <td className="flex items-center gap-2 w-full sm:w-auto">
                      <Button 
                        onClick={() => handleApproveLeave(leave.id)}
                        className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-1.5 px-3 flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Approve
                      </Button>
                      <Button 
                        onClick={() => handleRejectLeave(leave.id)}
                        variant="secondary"
                        className="flex-1 sm:flex-none text-red-600 hover:bg-red-50 text-xs py-1.5 px-3 flex items-center justify-center gap-1 border-red-200"
                      >
                        <XCircle className="h-4 w-4" /> Reject
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}