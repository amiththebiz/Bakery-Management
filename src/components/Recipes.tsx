import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Badge, Button, Modal, Input, Spinner } from '@/components/ui';
import { formatLKR } from '@/lib/format';
import { Plus, Trash2, Layers, Calculator, FileSpreadsheet, Package, Sparkles, Edit3, Sliders, TrendingUp } from 'lucide-react';

type RecipeRow = {
  id: number;
  good_id: number;
  raw_material_id: number;
  quantity_per_batch: number;
};

export default function Recipes() {
  const [goods, setGoods] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [prodCosts, setProdCosts] = useState<any[]>([]);
  const [pkgCosts, setPkgCosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [customBaseQty, setCustomBaseQty] = useState<number>(10);
  const [targetMargin, setTargetMargin] = useState<string>('20');
  const [customSellingPrice, setCustomSellingPrice] = useState<string>('');

  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [popupRows, setPopupRows] = useState<{ raw_material_id: string; quantity: string }[]>([
    { raw_material_id: '', quantity: '' }
  ]);
  const [savingRecipe, setSavingRecipe] = useState(false);

  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [prodForm, setProdForm] = useState({ 
    baker_daily_wage: '', 
    baker_units_per_day: '', 
    helper_daily_wage: '', 
    gas_cost: '' 
  });
  const [extraCosts, setExtraCosts] = useState<{ name: string; amount: string }[]>([]);
  const [newExtraName, setNewExtraName] = useState('');
  const [newExtraAmount, setNewExtraAmount] = useState('');
  const [savingProdModal, setSavingProdModal] = useState(false);

  const [pkgModalOpen, setPkgModalOpen] = useState(false);
  const [pkgForm, setPkgForm] = useState({
    total_units: '10000',
    units_per_packet: '100',
    polythene_cost_per_packet: '',
    label_cost_per_packet: '',
    packer_daily_wage: '',
    packets_per_day: ''
  });
  const [customPkgItems, setCustomPkgItems] = useState<{ name: string; cost: string }[]>([]);
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgCost, setNewPkgCost] = useState('');
  const [savingPkgModal, setSavingPkgModal] = useState(false);

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [newProdForm, setNewProdForm] = useState({
    product_code: '',
    product_name: '',
    base_type: 'FLOUR',
    packets_per_batch: '100',
    units_per_batch: '10000',
    lead_time_days: '0',
    unit_type: 'PACKET'
  });
  const [savingProduct, setSavingProduct] = useState(false);

  const [editProductModalOpen, setEditProductModalOpen] = useState(false);
  const [editProdForm, setEditProdForm] = useState({
    product_code: '',
    product_name: '',
    base_type: 'FLOUR',
    packets_per_batch: '100',
    units_per_batch: '10000',
    lead_time_days: '0',
    unit_type: 'PACKET'
  });
  const [updatingProduct, setUpdatingProduct] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const gRes = await supabase.from('bakery_goods').select('*');
      const mRes = await supabase.from('bakery_raw_materials').select('*');
      const rRes = await supabase.from('bakery_recipes').select('*');
      const pRes = await supabase.from('bakery_production_costs').select('*');
      const pkRes = await supabase.from('bakery_packaging_costs').select('*');

      const loadedGoods = gRes.data || [];
      setGoods(loadedGoods);
      setMaterials(mRes.data || []);
      setRecipes(rRes.data || []);
      setProdCosts(pRes.data || []);
      setPkgCosts(pkRes.data || []);

      if (loadedGoods.length > 0 && !selectedProductId) {
        const firstId = String(loadedGoods[0].good_id || loadedGoods[0].id);
        setSelectedProductId(firstId);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
    setLoading(false);
  }, [selectedProductId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const matMap = useMemo(() => new Map(materials.map((m) => [String(m.id || m.material_id), m])), [materials]);
  const selectedProduct = goods.find(g => String(g.good_id || g.id) === String(selectedProductId));

  const currentRecipes = selectedProductId ? recipes.filter(r => String(r.good_id) === String(selectedProductId)) : [];
  const pBase = selectedProduct?.base_type || 'FLOUR';

  const baseRecipeItem = useMemo(() => {
    return currentRecipes.find(r => {
      const mat = matMap.get(String(r.raw_material_id));
      const matName = (mat?.name || mat?.material_name || '').toLowerCase();
      
      if (pBase === 'Biscute Curb' || pBase.toLowerCase().includes('biscuit') || pBase.toLowerCase().includes('curb')) {
        return matName.includes('biscuit') || matName.includes('crumb') || matName.includes('biscute') || matName.includes('curb') || matName.includes('කුඩු') || matName.includes('බිස්කට්');
      } else {
        return matName.includes('flour') || matName.includes('piti') || matName.includes('පිටි') || matName.includes('maida');
      }
    }) || currentRecipes[0];
  }, [currentRecipes, matMap, pBase]);

  const originalBaseQty = baseRecipeItem ? Number(baseRecipeItem.quantity_per_batch) || 10 : 10;

  useEffect(() => {
    if (selectedProduct) {
      const p = prodCosts.find(x => String(x.good_id) === String(selectedProductId)) || {};
      const pk = pkgCosts.find(x => String(x.good_id) === String(selectedProductId)) || {};

      setProdForm({
        baker_daily_wage: p.baker_daily_wage ?? '',
        baker_units_per_day: p.baker_units_per_day ?? '',
        helper_daily_wage: p.helper_daily_wage ?? '',
        gas_cost: p.gas_cost ?? ''
      });

      setExtraCosts(Array.isArray(p.extra_costs) ? p.extra_costs : []);

      setPkgForm({
        total_units: String(pk.total_units ?? selectedProduct.units_per_batch ?? 10000),
        units_per_packet: String(pk.units_per_packet ?? 100),
        polythene_cost_per_packet: String(pk.polythene_cost_per_packet ?? ''),
        label_cost_per_packet: String(pk.label_cost_per_packet ?? ''),
        packer_daily_wage: String(pk.packer_daily_wage ?? ''),
        packets_per_day: String(pk.packets_per_day ?? '')
      });

      setCustomPkgItems(Array.isArray(pk.custom_items) ? pk.custom_items : []);

      setEditProdForm({
        product_code: selectedProduct.product_code || '',
        product_name: selectedProduct.product_name || '',
        base_type: selectedProduct.base_type || 'FLOUR',
        packets_per_batch: String(selectedProduct.packets_per_batch || 100),
        units_per_batch: String(selectedProduct.units_per_batch || 10000),
        lead_time_days: String(selectedProduct.lead_time_days ?? 0),
        unit_type: selectedProduct.unit_type || 'PACKET'
      });
    }
  }, [selectedProductId, prodCosts, pkgCosts, selectedProduct]);

  useEffect(() => {
    setCustomBaseQty(originalBaseQty);
  }, [originalBaseQty]);

  const ratio = originalBaseQty > 0 ? customBaseQty / originalBaseQty : 1;

  const totalMatCost = currentRecipes.reduce((sum, r) => {
    const mat = matMap.get(String(r.raw_material_id));
    const scaledQty = r.quantity_per_batch * ratio;
    return sum + (mat ? scaledQty * (mat.unit_cost || 0) : 0);
  }, 0);

  const baseUnits = Number(pkgForm.total_units) || 10000;
  const scaledUnits = baseUnits * ratio;
  const materialCostPerUnit = scaledUnits > 0 ? totalMatCost / scaledUnits : 0;

  const bakerTotal = Number(prodForm.baker_daily_wage) || 0;
  const helperTotal = Number(prodForm.helper_daily_wage) || 0;
  const gasTotal = (Number(prodForm.gas_cost) || 0) * ratio;
  const unitsPerDay = Number(prodForm.baker_units_per_day) || (scaledUnits > 0 ? scaledUnits : 1);

  const bakerCostPerUnit = bakerTotal / unitsPerDay;
  const helperCostPerUnit = helperTotal / unitsPerDay;
  const gasPerUnit = gasTotal / (scaledUnits > 0 ? scaledUnits : 1);
  const extraCostsPerUnit = extraCosts.reduce((sum, item) => sum + ((Number(item.amount) || 0) / (scaledUnits > 0 ? scaledUnits : 1)), 0);

  const totalProdCostPerUnit = bakerCostPerUnit + helperCostPerUnit + gasPerUnit + extraCostsPerUnit;

  const unitsPerPacketVal = Number(pkgForm.units_per_packet) || 100;
  const totalPackets = scaledUnits > 0 ? scaledUnits / unitsPerPacketVal : 0;

  const polyCostPerPkt = Number(pkgForm.polythene_cost_per_packet) || 0;
  const labelCostPerPkt = Number(pkgForm.label_cost_per_packet) || 0;
  const packerWageDaily = Number(pkgForm.packer_daily_wage) || 0;
  const packetsPackedPerDay = Number(pkgForm.packets_per_day) || (totalPackets > 0 ? totalPackets : 1);

  const packerWagePerPacket = packetsPackedPerDay > 0 ? packerWageDaily / packetsPackedPerDay : 0;
  const customPkgPerPacket = customPkgItems.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);

  const totalPkgCostPerPacket = polyCostPerPkt + labelCostPerPkt + packerWagePerPacket + customPkgPerPacket;
  const totalPkgCostPerUnit = unitsPerPacketVal > 0 ? totalPkgCostPerPacket / unitsPerPacketVal : 0;
  const totalPkgCostPerPacketFinal = totalPkgCostPerUnit * unitsPerPacketVal;

  const grandTotalUnitCost = materialCostPerUnit + totalProdCostPerUnit + totalPkgCostPerUnit;
  const grandTotalPacketCost = grandTotalUnitCost * unitsPerPacketVal;

  const matPercentage = grandTotalUnitCost > 0 ? (materialCostPerUnit / grandTotalUnitCost) * 100 : 0;
  const prodPercentage = grandTotalUnitCost > 0 ? (totalProdCostPerUnit / grandTotalUnitCost) * 100 : 0;
  const pkgPercentage = grandTotalUnitCost > 0 ? (totalPkgCostPerUnit / grandTotalUnitCost) * 100 : 0;

  const marginNum = Number(targetMargin) || 0;
  const calculatedSellingPrice = grandTotalUnitCost > 0 ? grandTotalUnitCost / (1 - marginNum / 100) : 0;
  const customPriceNum = Number(customSellingPrice) || 0;
  const derivedMargin = customPriceNum > 0 ? ((customPriceNum - grandTotalUnitCost) / customPriceNum) * 100 : 0;

  const openRecipeModal = () => {
    if (currentRecipes.length > 0) {
      setPopupRows(currentRecipes.map(r => ({
        raw_material_id: String(r.raw_material_id),
        quantity: String(r.quantity_per_batch)
      })));
    } else {
      setPopupRows([{ raw_material_id: '', quantity: '' }]);
    }
    setRecipeModalOpen(true);
  };

  const handleSaveFullRecipe = async () => {
    if (!selectedProductId) return;
    setSavingRecipe(true);
    try {
      await supabase.from('bakery_recipes').delete().eq('good_id', parseInt(selectedProductId));
      const validRows = popupRows
        .filter(row => row.raw_material_id && row.quantity)
        .map(row => ({
          good_id: parseInt(selectedProductId),
          raw_material_id: parseInt(row.raw_material_id),
          quantity_per_batch: parseFloat(row.quantity) || 0
        }));

      if (validRows.length > 0) {
        await supabase.from('bakery_recipes').insert(validRows);
      }
      alert('Recipe saved successfully!');
      setRecipeModalOpen(false);
      await fetchAll();
    } catch (err: any) {
      alert('Error saving recipe: ' + err.message);
    }
    setSavingRecipe(false);
  };

  const handleSaveProductionCosts = async () => {
    if (!selectedProductId) return;
    setSavingProdModal(true);
    try {
      const payload = {
        good_id: parseInt(selectedProductId),
        baker_daily_wage: parseFloat(prodForm.baker_daily_wage) || 0,
        baker_units_per_day: parseFloat(prodForm.baker_units_per_day) || 1,
        helper_daily_wage: parseFloat(prodForm.helper_daily_wage) || 0,
        gas_cost: parseFloat(prodForm.gas_cost) || 0,
        extra_costs: extraCosts
      };
      const { error } = await supabase.from('bakery_production_costs').upsert(payload, { onConflict: 'good_id' });
      if (error) throw error;
      alert('Production wages & gas costs saved successfully!');
      setProdModalOpen(false);
      fetchAll();
    } catch (e: any) {
      alert('Error saving production costs: ' + e.message);
    }
    setSavingProdModal(false);
  };

  const handleSavePackagingCosts = async () => {
    if (!selectedProductId) return;
    setSavingPkgModal(true);
    try {
      const payload = {
        good_id: parseInt(selectedProductId),
        total_units: parseFloat(pkgForm.total_units) || 10000,
        units_per_packet: parseFloat(pkgForm.units_per_packet) || 100,
        polythene_cost_per_packet: parseFloat(pkgForm.polythene_cost_per_packet) || 0,
        label_cost_per_packet: parseFloat(pkgForm.label_cost_per_packet) || 0,
        packer_daily_wage: parseFloat(pkgForm.packer_daily_wage) || 0,
        packets_per_day: parseFloat(pkgForm.packets_per_day) || 100,
        custom_items: customPkgItems,
        polythene_cost: (parseFloat(pkgForm.polythene_cost_per_packet) || 0) * totalPackets,
        label_cost: (parseFloat(pkgForm.label_cost_per_packet) || 0) * totalPackets
      };
      const { error } = await supabase.from('bakery_packaging_costs').upsert(payload, { onConflict: 'good_id' });
      if (error) throw error;
      alert('Packaging costs saved successfully!');
      setPkgModalOpen(false);
      fetchAll();
    } catch (e: any) {
      alert('Error saving packaging costs: ' + e.message);
    }
    setSavingPkgModal(false);
  };

  const handleSaveNewProduct = async () => {
    if (!newProdForm.product_code || !newProdForm.product_name) {
      alert('Please enter Product Code and Product Name.');
      return;
    }
    setSavingProduct(true);
    try {
      const payload = {
        product_code: newProdForm.product_code,
        product_name: newProdForm.product_name,
        base_type: newProdForm.base_type,
        packets_per_batch: parseFloat(newProdForm.packets_per_batch) || 100,
        units_per_batch: parseFloat(newProdForm.units_per_batch) || 10000,
        lead_time_days: parseInt(newProdForm.lead_time_days) || 0,
        unit_type: newProdForm.unit_type
      };
      const { data, error } = await supabase.from('bakery_goods').insert(payload).select();
      if (error) throw error;
      alert('New product added successfully!');
      setProductModalOpen(false);
      setNewProdForm({ product_code: '', product_name: '', base_type: 'FLOUR', packets_per_batch: '100', units_per_batch: '10000', lead_time_days: '0', unit_type: 'PACKET' });
      fetchAll();
      if (data && data[0]) {
        setSelectedProductId(String(data[0].good_id || data[0].id));
      }
    } catch (err: any) {
      alert('Error adding product: ' + err.message);
    }
    setSavingProduct(false);
  };

  const handleUpdateProduct = async () => {
    if (!selectedProductId) return;
    setUpdatingProduct(true);
    try {
      const payload = {
        product_code: editProdForm.product_code,
        product_name: editProdForm.product_name,
        base_type: editProdForm.base_type,
        packets_per_batch: parseFloat(editProdForm.packets_per_batch) || 100,
        units_per_batch: parseFloat(editProdForm.units_per_batch) || 10000,
        lead_time_days: parseInt(editProdForm.lead_time_days) || 0,
        unit_type: editProdForm.unit_type
      };
      const pkCol = selectedProduct.good_id !== undefined ? 'good_id' : 'id';
      const { error } = await supabase.from('bakery_goods').update(payload).eq(pkCol, selectedProductId);
      if (error) throw error;
      alert('Product updated successfully!');
      setEditProductModalOpen(false);
      fetchAll();
    } catch (err: any) {
      alert('Error updating product: ' + err.message);
    }
    setUpdatingProduct(false);
  };

  if (loading) return <Spinner />;

  const pCode = selectedProduct?.product_code || '';
  const pName = selectedProduct?.product_name || 'Select Product';
  const pLeadTime = Number(selectedProduct?.lead_time_days) || 0;
  const pUnitType = selectedProduct?.unit_type || 'PACKET';

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Recipe & Cost Sheet Matrix</h1>
          <p className="text-xs text-stone-500 mt-0.5">Manage recipes, production wages, and packaging costs based on Flour / Biscuit Curb base.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Button onClick={() => setProductModalOpen(true)} className="bg-stone-900 hover:bg-stone-800 text-white text-xs flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Add Product
          </Button>

          {selectedProduct && (
            <Button onClick={() => setEditProductModalOpen(true)} className="bg-stone-700 hover:bg-stone-800 text-white text-xs flex items-center gap-1.5">
              <Edit3 className="h-4 w-4" /> Edit Product
            </Button>
          )}

          <div className="flex items-center gap-2">
            <select 
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="border border-stone-300 rounded-xl px-4 py-2 text-sm font-bold text-stone-800 bg-stone-50 w-full md:w-56"
            >
              {goods.length === 0 ? (
                <option value="">No products in database</option>
              ) : (
                goods.map(g => {
                  const id = String(g.good_id || g.id);
                  const code = g.product_code || '';
                  const name = g.product_name || 'Item';
                  return (
                    <option key={id} value={id}>
                      {code ? `${code} — ${name}` : name}
                    </option>
                  );
                })
              )}
            </select>
          </div>
        </div>
      </div>

      {selectedProduct ? (
        <div className="space-y-6">
          <div className="bg-stone-900 text-white p-6 rounded-2xl flex flex-wrap justify-between items-center gap-6 shadow-xl">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {pCode && <span className="px-2.5 py-0.5 rounded bg-amber-500 text-stone-950 font-bold text-xs">{pCode}</span>}
                <span className="text-xl font-bold">{pName}</span>
                <Badge color={pBase === 'Biscute Curb' ? 'blue' : 'orange'}>{pBase} Base</Badge>
                <Badge color={pUnitType === 'PACKET' ? 'purple' : 'emerald'}>{pUnitType === 'PACKET' ? 'Packet-based' : 'Item/Unit-based'}</Badge>
                {pLeadTime > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                    Lead Time: {pLeadTime} Day{pLeadTime > 1 ? 's' : ''} Prior
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-6 mt-3">
                <div className="bg-stone-800 px-4 py-2 rounded-xl border border-stone-700">
                  <p className="text-[10px] text-stone-400 uppercase font-semibold">Output Units</p>
                  <p className="text-2xl font-mono font-extrabold text-amber-400">{Math.round(scaledUnits)}</p>
                </div>
                <div className="bg-stone-800 px-4 py-2 rounded-xl border border-stone-700">
                  <p className="text-[10px] text-stone-400 uppercase font-semibold">Total Packets</p>
                  <p className="text-2xl font-mono font-extrabold text-amber-400">{Math.round(totalPackets)}</p>
                </div>
              </div>
            </div>

            <div className="bg-stone-800 p-3.5 rounded-xl border border-stone-700 flex items-center gap-4">
              <Sliders className="h-5 w-5 text-amber-400" />
              <div>
                <label className="block text-[11px] text-amber-400 uppercase font-bold">Batch Qty / Base ({pBase} Kg):</label>
                <div className="flex items-center gap-2 mt-1">
                  <input 
                    type="number" 
                    step="0.5"
                    value={customBaseQty}
                    onChange={(e) => setCustomBaseQty(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="bg-stone-900 border border-stone-600 text-white font-mono font-bold px-3 py-1.5 rounded-lg text-sm w-36"
                  />
                </div>
              </div>
            </div>

            <div className="text-right bg-stone-800 px-6 py-4 rounded-xl border border-stone-700 space-y-2">
              <div>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Grand Total Cost (Per Unit)</p>
                <p className="text-2xl font-mono font-extrabold text-amber-400">{formatLKR(grandTotalUnitCost)}</p>
              </div>
              <div className="pt-2 border-t border-stone-700">
                <p className="text-[10px] text-amber-300 uppercase tracking-wider font-semibold">Cost Per Packet ({unitsPerPacketVal} units)</p>
                <p className="text-2xl font-mono font-extrabold text-amber-400">{formatLKR(grandTotalPacketCost)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4 border-b pb-3">
                  <div>
                    <h3 className="font-bold text-stone-800 flex items-center gap-2">
                      <Layers className="h-4 w-4 text-amber-600" /> Auto-Calculated Cost Sheet ({pBase} Base)
                    </h3>
                    <p className="text-xs text-stone-400">Quantities scale automatically based on recipe base qty ({customBaseQty} Kg).</p>
                  </div>
                  <Button onClick={openRecipeModal} className="text-xs bg-amber-600 hover:bg-amber-700 text-white">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Edit Recipe
                  </Button>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 text-left text-stone-400 font-mono text-xs">
                      <th className="pb-2">Material Name</th>
                      <th className="pb-2 text-right">Scaled Qty ({customBaseQty} Kg Base)</th>
                      <th className="pb-2 text-right">Unit Cost</th>
                      <th className="pb-2 text-right">Line Cost (LKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {currentRecipes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-stone-400">
                          No recipe set for this product yet.<br/>
                          <button onClick={openRecipeModal} className="mt-2 text-amber-600 font-bold underline text-xs">Click here to Set Recipe</button>
                        </td>
                      </tr>
                    ) : (
                      currentRecipes.map((r) => {
                        const mat = matMap.get(String(r.raw_material_id));
                        const scaledQty = r.quantity_per_batch * ratio;
                        const lineCost = mat ? scaledQty * (mat.unit_cost || 0) : 0;
                        return (
                          <tr key={r.id} className="hover:bg-stone-50">
                            <td className="py-3 font-medium text-stone-800">{mat?.name || mat?.material_name || 'Unknown'}</td>
                            <td className="py-3 text-right font-mono font-bold text-amber-700">{scaledQty.toFixed(2)} {mat?.unit}</td>
                            <td className="py-3 text-right font-mono text-stone-500">{formatLKR(mat?.unit_cost || 0)}</td>
                            <td className="py-3 text-right font-mono font-bold text-stone-800">{formatLKR(lineCost)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                <div className="mt-4 pt-3 border-t flex justify-between items-center text-sm font-semibold bg-stone-50 p-3 rounded-xl">
                  <span>Total Material Cost (for {customBaseQty} Kg Base):</span>
                  <span className="font-mono text-stone-800">{formatLKR(totalMatCost)}</span>
                </div>
              </Card>

              <Card className="p-5 space-y-4">
                <h3 className="font-bold text-stone-800 text-sm flex items-center gap-2 border-b pb-3">
                  <Sparkles className="h-4 w-4 text-amber-600" /> Detailed Cost Summary & Breakdown (Per Unit / Packet)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-sm space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-amber-900 uppercase">1. Material Cost</span>
                      <span className="text-xs font-mono font-bold bg-amber-200 px-2 py-0.5 rounded text-amber-900">{matPercentage.toFixed(1)}%</span>
                    </div>
                    <p className="text-2xl font-mono font-extrabold text-amber-950">{formatLKR(materialCostPerUnit)}</p>
                    <p className="text-[11px] text-amber-800">Per Packet ({unitsPerPacketVal} units): {formatLKR(materialCostPerUnit * unitsPerPacketVal)}</p>
                  </div>

                  <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 shadow-sm space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-purple-900 uppercase">2. Production Cost</span>
                      <span className="text-xs font-mono font-bold bg-purple-200 px-2 py-0.5 rounded text-purple-900">{prodPercentage.toFixed(1)}%</span>
                    </div>
                    <p className="text-2xl font-mono font-extrabold text-purple-950">{formatLKR(totalProdCostPerUnit)}</p>
                    <p className="text-[11px] text-purple-800">Per Packet ({unitsPerPacketVal} units): {formatLKR(totalProdCostPerUnit * unitsPerPacketVal)}</p>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-blue-900 uppercase">3. Packaging Cost</span>
                      <span className="text-xs font-mono font-bold bg-blue-200 px-2 py-0.5 rounded text-blue-900">{pkgPercentage.toFixed(1)}%</span>
                    </div>
                    <p className="text-2xl font-mono font-extrabold text-blue-950">{formatLKR(totalPkgCostPerUnit)}</p>
                    <div className="text-[11px] text-blue-800 space-y-0.5">
                      <strong className="text-blue-950">Cost per Packet: {formatLKR(totalPkgCostPerPacketFinal)}</strong>
                      <div>Poly: {formatLKR(polyCostPerPkt)} | Label: {formatLKR(labelCostPerPkt)} | Packer: {formatLKR(packerWagePerPacket)}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-5 rounded-2xl border border-emerald-200 shadow-sm space-y-4 mt-6">
                  <div className="flex items-center gap-2 border-b border-emerald-200 pb-3">
                    <TrendingUp className="h-5 w-5 text-emerald-700" />
                    <h4 className="font-bold text-emerald-900 text-base">Profit Margin & Selling Price Calculator</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm space-y-3">
                      <label className="block text-xs font-bold text-stone-700 uppercase">Target Profit Margin (%)</label>
                      <input 
                        type="number"
                        step="0.5"
                        value={targetMargin}
                        onChange={(e) => setTargetMargin(e.target.value)}
                        className="w-full border border-stone-300 rounded-xl px-3 py-2 text-base font-mono font-bold bg-stone-50"
                        placeholder="e.g. 20"
                      />
                      <div className="pt-2 border-t flex justify-between items-center">
                        <span className="text-xs text-stone-600 font-semibold">Recommended Selling Price (Per Unit):</span>
                        <span className="text-xl font-mono font-extrabold text-emerald-700">{formatLKR(calculatedSellingPrice)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-stone-500">
                        <span>Price per Packet ({unitsPerPacketVal} units):</span>
                        <span className="font-mono font-bold">{formatLKR(calculatedSellingPrice * unitsPerPacketVal)}</span>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm space-y-3">
                      <label className="block text-xs font-bold text-stone-700 uppercase">Custom Selling Price (Per Unit - LKR)</label>
                      <input 
                        type="number"
                        step="0.1"
                        value={customSellingPrice}
                        onChange={(e) => setCustomSellingPrice(e.target.value)}
                        className="w-full border border-stone-300 rounded-xl px-3 py-2 text-base font-mono font-bold bg-stone-50"
                        placeholder="e.g. Enter selling price"
                      />
                      <div className="pt-2 border-t flex justify-between items-center">
                        <span className="text-xs text-stone-600 font-semibold">Derived Profit Margin (%):</span>
                        <span className="text-xl font-mono font-extrabold text-teal-700">{customPriceNum > 0 ? `${derivedMargin.toFixed(1)}%` : '0.0%'}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-stone-500">
                        <span>Profit per Unit:</span>
                        <span className="font-mono font-bold text-emerald-600">{customPriceNum > 0 ? formatLKR(customPriceNum - grandTotalUnitCost) : formatLKR(0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="p-5 space-y-4">
                <div className="border-b pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-stone-700" />
                    <h3 className="font-bold text-stone-800 text-sm">Cost Setup & Configuration</h3>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button onClick={openRecipeModal} className="w-full bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-between text-xs py-3">
                    <span className="flex items-center gap-2 font-bold"><FileSpreadsheet className="h-4 w-4" /> 1. Set Raw Material Recipe</span>
                    <span>→</span>
                  </Button>

                  <Button onClick={() => setProdModalOpen(true)} className="w-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-between text-xs py-3">
                    <span className="flex items-center gap-2 font-bold"><Calculator className="h-4 w-4" /> 2. Setup Production Wages & Gas</span>
                    <span>→</span>
                  </Button>

                  <Button onClick={() => setPkgModalOpen(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-between text-xs py-3">
                    <span className="flex items-center gap-2 font-bold"><Package className="h-4 w-4" /> 3. Setup Packets & Packaging Cost</span>
                    <span>→</span>
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      ) : (
        <Card className="p-12 text-center text-stone-400">
          No products found in `bakery_goods` table. Please add products first.
        </Card>
      )}

      {/* POPUP MODAL FOR SETTING RECIPE */}
      <Modal open={recipeModalOpen} onClose={() => setRecipeModalOpen(false)} title={`Set Recipe & Base for: ${pName}`}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <p className="text-xs text-stone-500">
            Define raw material proportions for your standard batch recipe ({pBase} base). The first base material quantity will be used as the standard base.
          </p>

          <div className="space-y-3">
            {popupRows.map((row, index) => (
              <div key={index} className="flex items-center gap-2 bg-stone-50 p-2.5 rounded-xl border">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-stone-500 mb-1">Raw Material</label>
                  <select 
                    value={row.raw_material_id}
                    onChange={(e) => {
                      const updated = [...popupRows];
                      updated[index].raw_material_id = e.target.value;
                      setPopupRows(updated);
                    }}
                    className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-xs bg-white"
                  >
                    <option value="">-- Choose Material --</option>
                    {materials.map(m => (
                      <option key={String(m.id || m.material_id)} value={String(m.id || m.material_id)}>
                        {m.name || m.material_name} ({m.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-32">
                  <label className="block text-[10px] font-bold text-stone-500 mb-1">Quantity</label>
                  <input 
                    type="number"
                    step="0.001"
                    placeholder="e.g. 7"
                    value={row.quantity}
                    onChange={(e) => {
                      const updated = [...popupRows];
                      updated[index].quantity = e.target.value;
                      setPopupRows(updated);
                    }}
                    className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-xs bg-white font-mono"
                  />
                </div>

                <button 
                  type="button" 
                  onClick={() => setPopupRows(popupRows.filter((_, i) => i !== index))}
                  className="mt-5 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <button 
            type="button" 
            onClick={() => setPopupRows([...popupRows, { raw_material_id: '', quantity: '' }])}
            className="w-full py-2 border-2 border-dashed border-stone-300 rounded-xl text-xs font-bold text-stone-600 hover:border-amber-600 hover:text-amber-700 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> Add Another Material Row
          </button>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setRecipeModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveFullRecipe} disabled={savingRecipe} className="bg-amber-600 hover:bg-amber-700 text-white">
              {savingRecipe ? 'Saving...' : 'Save Recipe'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* POPUP MODAL FOR PRODUCTION WAGES & GAS COST SETUP */}
      <Modal open={prodModalOpen} onClose={() => setProdModalOpen(false)} title={`Production Wages & Gas Cost Setup: ${pName}`}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <p className="text-xs text-stone-500">
            Configure daily wages and gas expenses based on the {pBase} base quantity.
          </p>

          <div className="space-y-3">
            <Input label="Master Baker Daily Wage (LKR)" type="number" value={prodForm.baker_daily_wage} onChange={(v) => setProdForm({ ...prodForm, baker_daily_wage: v })} />
            <Input label="Units Produced / Day" type="number" value={prodForm.baker_units_per_day} onChange={(v) => setProdForm({ ...prodForm, baker_units_per_day: v })} />
            <Input label="Helper Daily Wage (LKR)" type="number" value={prodForm.helper_daily_wage} onChange={(v) => setProdForm({ ...prodForm, helper_daily_wage: v })} />
            <Input label="Gas Cost per Batch (LKR)" type="number" value={prodForm.gas_cost} onChange={(v) => setProdForm({ ...prodForm, gas_cost: v })} />
          </div>

          <div className="space-y-3 bg-stone-50 p-3 rounded-xl border">
            <p className="text-xs font-bold text-purple-800 uppercase">Additional Cost Items</p>
            {extraCosts.map((ex, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-lg border text-xs">
                <div>
                  <span className="font-bold text-stone-800">{ex.name}:</span> <span className="font-mono text-stone-600">{formatLKR(Number(ex.amount) || 0)}</span>
                </div>
                <button onClick={() => setExtraCosts(extraCosts.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 p-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            <div className="space-y-2 pt-2 border-t">
              <input 
                type="text" 
                placeholder="Cost Name (e.g. Electricity)" 
                value={newExtraName} 
                onChange={(e) => setNewExtraName(e.target.value)}
                className="w-full border rounded-lg px-2.5 py-1 text-xs bg-white"
              />
              <div className="flex gap-2">
                <input 
                  type="number" 
                  placeholder="Amount (LKR)" 
                  value={newExtraAmount} 
                  onChange={(e) => setNewExtraAmount(e.target.value)}
                  className="w-full border rounded-lg px-2.5 py-1 text-xs bg-white font-mono"
                />
                <button 
                  onClick={() => {
                    if (newExtraName && newExtraAmount) {
                      setExtraCosts([...extraCosts, { name: newExtraName, amount: newExtraAmount }]);
                      setNewExtraName('');
                      setNewExtraAmount('');
                    }
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg text-xs font-bold"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setProdModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveProductionCosts} disabled={savingProdModal} className="bg-purple-600 hover:bg-purple-700 text-white">
              {savingProdModal ? 'Saving...' : 'Save Production Costs'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* POPUP MODAL FOR PACKET-BASED PACKAGING COST SETUP */}
      <Modal open={pkgModalOpen} onClose={() => setPkgModalOpen(false)} title={`Packet-Based Packaging Cost Setup: ${pName}`}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <p className="text-xs text-stone-500">
            Configure total units, units per packet, packet costs, and packer daily wages.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Total Units in Batch" type="number" value={pkgForm.total_units} onChange={(v) => setPkgForm({ ...pkgForm, total_units: v })} />
            <Input label="Units per Packet" type="number" value={pkgForm.units_per_packet} onChange={(v) => setPkgForm({ ...pkgForm, units_per_packet: v })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Polythene Cost per Packet (LKR)" type="number" step="0.01" value={pkgForm.polythene_cost_per_packet} onChange={(v) => setPkgForm({ ...pkgForm, polythene_cost_per_packet: v })} />
            <Input label="Label Cost per Packet (LKR)" type="number" step="0.01" value={pkgForm.label_cost_per_packet} onChange={(v) => setPkgForm({ ...pkgForm, label_cost_per_packet: v })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Packer Daily Wage (LKR)" type="number" value={pkgForm.packer_daily_wage} onChange={(v) => setPkgForm({ ...pkgForm, packer_daily_wage: v })} />
            <Input label="Packets Packed / Day" type="number" value={pkgForm.packets_per_day} onChange={(v) => setPkgForm({ ...pkgForm, packets_per_day: v })} />
          </div>

          <div className="space-y-3 bg-stone-50 p-3 rounded-xl border">
            <p className="text-xs font-bold text-blue-800 uppercase">Custom Packaging Items (per packet)</p>
            {customPkgItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-lg border text-xs">
                <div>
                  <span className="font-bold text-stone-800">{item.name}:</span> <span className="font-mono text-stone-600">{formatLKR(Number(item.cost) || 0)}</span>
                </div>
                <button onClick={() => setCustomPkgItems(customPkgItems.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 p-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            <div className="space-y-2 pt-2 border-t">
              <input 
                type="text" 
                placeholder="Item Name (e.g. Box / Staple)" 
                value={newPkgName} 
                onChange={(e) => setNewPkgName(e.target.value)}
                className="w-full border rounded-lg px-2.5 py-1 text-xs bg-white"
              />
              <div className="flex gap-2">
                <input 
                  type="number" 
                  step="0.01"
                  placeholder="Cost / Packet (LKR)" 
                  value={newPkgCost} 
                  onChange={(e) => setNewPkgCost(e.target.value)}
                  className="w-full border rounded-lg px-2.5 py-1 text-xs bg-white font-mono"
                />
                <button 
                  onClick={() => {
                    if (newPkgName && newPkgCost) {
                      setCustomPkgItems([...customPkgItems, { name: newPkgName, cost: newPkgCost }]);
                      setNewPkgName('');
                      setNewPkgCost('');
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-xs font-bold"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setPkgModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePackagingCosts} disabled={savingPkgModal} className="bg-blue-600 hover:bg-blue-700 text-white">
              {savingPkgModal ? 'Saving...' : 'Save Packaging Costs'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* POPUP MODAL FOR ADDING NEW PRODUCT */}
      <Modal open={productModalOpen} onClose={() => setProductModalOpen(false)} title="Add New Bakery Product">
        <div className="space-y-4">
          <Input label="Product Code (e.g. LS, FB, 3in1)" value={newProdForm.product_code} onChange={(v) => setNewProdForm({ ...newProdForm, product_code: v })} placeholder="e.g. NEW1" />
          <Input label="Product Name" value={newProdForm.product_name} onChange={(v) => setNewProdForm({ ...newProdForm, product_name: v })} placeholder="e.g. Special Bun" />
          
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Base Type</label>
            <select 
              value={newProdForm.base_type} 
              onChange={(e) => setNewProdForm({ ...newProdForm, base_type: e.target.value })}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm bg-white font-bold"
            >
              <option value="FLOUR">FLOUR (පිටි)</option>
              <option value="Biscute Curb">Biscute Curb (බිස්කට් කුඩු)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Planning Basis / Unit Type</label>
            <select 
              value={newProdForm.unit_type} 
              onChange={(e) => setNewProdForm({ ...newProdForm, unit_type: e.target.value })}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm bg-white font-bold text-stone-800"
            >
              <option value="PACKET">Packet-based (Planned & sold in Packets)</option>
              <option value="UNIT">Item / Unit-based (Planned & sold in Pieces/Units)</option>
            </select>
          </div>

          <Input label="Default Units per Batch" type="number" value={newProdForm.units_per_batch} onChange={(v) => setNewProdForm({ ...newProdForm, units_per_batch: v })} placeholder="10000" />
          <Input label="Default Packets per Batch" type="number" value={newProdForm.packets_per_batch} onChange={(v) => setNewProdForm({ ...newProdForm, packets_per_batch: v })} placeholder="100" />
          <Input label="Production Lead Time (Days Before Sale)" type="number" value={newProdForm.lead_time_days} onChange={(v) => setNewProdForm({ ...newProdForm, lead_time_days: v })} placeholder="0" />

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setProductModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveNewProduct} disabled={savingProduct} className="bg-stone-900 text-white">
              {savingProduct ? 'Saving...' : 'Save Product'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* POPUP MODAL FOR EDITING SELECTED PRODUCT */}
      <Modal open={editProductModalOpen} onClose={() => setEditProductModalOpen(false)} title={`Edit Product: ${pName}`}>
        <div className="space-y-4">
          <Input label="Product Code" value={editProdForm.product_code} onChange={(v) => setEditProdForm({ ...editProdForm, product_code: v })} />
          <Input label="Product Name" value={editProdForm.product_name} onChange={(v) => setEditProdForm({ ...editProdForm, product_name: v })} />
          
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Base Type</label>
            <select 
              value={editProdForm.base_type} 
              onChange={(e) => setEditProdForm({ ...editProdForm, base_type: e.target.value })}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm bg-white font-bold"
            >
              <option value="FLOUR">FLOUR (පිටි)</option>
              <option value="Biscute Curb">Biscute Curb (බිස්කට් කුඩු)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Planning Basis / Unit Type</label>
            <select 
              value={editProdForm.unit_type} 
              onChange={(e) => setEditProdForm({ ...editProdForm, unit_type: e.target.value })}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm bg-white font-bold text-stone-800"
            >
              <option value="PACKET">Packet-based (Planned & sold in Packets)</option>
              <option value="UNIT">Item / Unit-based (Planned & sold in Pieces/Units)</option>
            </select>
          </div>

          <Input label="Default Units per Batch" type="number" value={editProdForm.units_per_batch} onChange={(v) => setEditProdForm({ ...editProdForm, units_per_batch: v })} />
          <Input label="Default Packets per Batch" type="number" value={editProdForm.packets_per_batch} onChange={(v) => setEditProdForm({ ...editProdForm, packets_per_batch: v })} />
          <Input label="Production Lead Time (Days Before Sale)" type="number" value={editProdForm.lead_time_days} onChange={(v) => setEditProdForm({ ...editProdForm, lead_time_days: v })} />

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setEditProductModalOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateProduct} disabled={updatingProduct} className="bg-stone-900 text-white">
              {updatingProduct ? 'Updating...' : 'Update Product'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}