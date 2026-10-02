import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Button, Spinner, Modal, Input } from '@/components/ui';
import { ClipboardList, Play, CheckCircle2, Clock, RefreshCw, Plus, ShieldCheck, ChefHat, BarChart3, ArrowRightLeft } from 'lucide-react';

export default function BatchCards() {
  const [batchCards, setBatchCards] = useState<any[]>([]);
  const [goods, setGoods] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [packingBatches, setPackingBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [actualUnits, setActualUnits] = useState('');
  const [wastageUnits, setWastageUnits] = useState('');
  const [finishNotes, setFinishNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [cardToAssign, setCardToAssign] = useState<any>(null);
  const [selectedStaffList, setSelectedStaffList] = useState<string[]>([]);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newCard, setNewCard] = useState({
    batch_number: `BATCH-${Math.floor(1000 + Math.random() * 9000)}`,
    good_id: '',
    planned_units: '',
    bakers_assigned: ''
  });

  const [, setTick] = useState(0);
  useEffect(() => {
    const timerInterval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timerInterval);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [bcRes, gRes, rRes, mRes, empRes, packRes] = await Promise.all([
        supabase.from('bakery_batch_cards').select('*').order('id', { ascending: false }),
        supabase.from('bakery_goods').select('*'),
        supabase.from('bakery_recipes').select('*').then(res => res, () => ({ data: [] })),
        supabase.from('bakery_raw_materials').select('*').then(res => res, () => ({ data: [] })),
        supabase.from('bakery_employees').select('*').then(res => res, () => ({ data: [] })),
        supabase.from('bakery_packing_batches').select('*').then(res => res, () => ({ data: [] }))
      ]);

      setBatchCards(bcRes.data || []);
      setGoods(gRes.data || []);
      setRecipes(rRes.data || []);
      setMaterials(mRes.data || []);
      setEmployees(empRes.data || []);
      setPackingBatches(packRes.data || []);
    } catch (err) {
      console.error('Error fetching batch data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const goodsMap = new Map(goods.map(g => [String(g.good_id || g.id), g]));
  const matMap = new Map(materials.map(m => [String(m.id || m.material_id), m]));

  const recipeMap = new Map<string, any[]>();
  recipes.forEach(r => {
    const gId = String(r.good_id);
    if (!recipeMap.has(gId)) recipeMap.set(gId, []);
    recipeMap.get(gId)!.push(r);
  });

  const toggleStaffSelection = (name: string) => {
    if (selectedStaffList.includes(name)) {
      setSelectedStaffList(selectedStaffList.filter(n => n !== name));
    } else {
      setSelectedStaffList([...selectedStaffList, name]);
    }
  };

  const handleApproveBatch = async () => {
    if (!cardToAssign || selectedStaffList.length === 0) {
      alert('Please select at least one staff member.');
      return;
    }
    try {
      const staffString = selectedStaffList.join(', ');
      const { error } = await supabase
        .from('bakery_batch_cards')
        .update({
          approved_by_admin: true,
          bakers_assigned: staffString,
          status: 'Pending'
        })
        .eq('id', cardToAssign.id);

      if (error) throw error;

      alert('Batch card approved and assigned to staff successfully!');
      setAssignModalOpen(false);
      setCardToAssign(null);
      setSelectedStaffList([]);
      fetchData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleStartBatch = async (id: number) => {
    const startTime = new Date().toISOString();
    try {
      const { error } = await supabase
        .from('bakery_batch_cards')
        .update({
          status: 'In Progress',
          start_time: startTime
        })
        .eq('id', id);

      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleFinishBatch = async () => {
    if (!selectedCard || !actualUnits) {
      alert('Please enter the actual production units.');
      return;
    }
    setSubmitting(true);
    try {
      const finishTime = new Date().toISOString();
      const { error } = await supabase
        .from('bakery_batch_cards')
        .update({
          status: 'Completed',
          finish_time: finishTime,
          actual_units: parseFloat(actualUnits) || 0,
          wastage_units: parseFloat(wastageUnits) || 0,
          notes: finishNotes
        })
        .eq('id', selectedCard.id);

      if (error) throw error;

      alert('Batch completed and recorded successfully!');
      setFinishModalOpen(false);
      setSelectedCard(null);
      setActualUnits('');
      setWastageUnits('');
      setFinishNotes('');
      fetchData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setSubmitting(false);
  };

  const handleTransferToPacking = async (card: any) => {
    try {
      const goodUnits = Number(card.actual_units || 0);

      if (goodUnits <= 0) {
        alert('No good units available to transfer to packing.');
        return;
      }

      const { error } = await supabase.from('bakery_packing_batches').insert({
        batch_card_id: card.id,
        batch_number: card.batch_number,
        good_id: card.good_id,
        planned_units: goodUnits,
        remaining_units: goodUnits,
        status: 'Pending Packing'
      });

      if (error) throw error;
      alert(`Success! Transferred ${goodUnits} good units to Packing Management.`);
      fetchData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleAddCard = async () => {
    if (!newCard.good_id || !newCard.planned_units) {
      alert('Please fill in all required fields.');
      return;
    }
    try {
      const { error } = await supabase.from('bakery_batch_cards').insert({
        batch_number: newCard.batch_number,
        good_id: parseInt(newCard.good_id),
        planned_units: parseFloat(newCard.planned_units),
        planned_qty: parseFloat(newCard.planned_units),
        bakers_assigned: newCard.bakers_assigned || 'Pending Assignment',
        approved_by_admin: false,
        status: 'Pending',
        production_date: new Date().toISOString().split('T')[0]
      });
      if (error) throw error;

      alert('Batch card created successfully!');
      setAddModalOpen(false);
      setNewCard({
        batch_number: `BATCH-${Math.floor(1000 + Math.random() * 9000)}`,
        good_id: '',
        planned_units: '',
        bakers_assigned: ''
      });
      fetchData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const getElapsedTime = (startTime: string, finishTime?: string) => {
    if (!startTime) return 'Not started';
    const start = new Date(startTime).getTime();
    const end = finishTime ? new Date(finishTime).getTime() : Date.now();
    const diffMs = Math.max(0, end - start);
    
    const diffSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;

    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const filteredCards = batchCards.filter(card => {
    const status = String(card.status || '').toLowerCase();
    const isCompleted = status === 'completed' || status === 'finished';
    if (activeTab === 'completed') return isCompleted;
    return !isCompleted;
  });

  if (loading) return <Spinner />;

  return (
    <div className="space-y-8 pb-12">
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-amber-600" /> Daily Production Batch Cards & Recipes
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">Admin approval, staff assignments, recipe ingredients, and production analytics.</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button onClick={fetchData} variant="secondary" className="text-xs flex items-center gap-1.5">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button onClick={() => setAddModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white text-xs flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Create New Batch Card
          </Button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-2 border-b border-stone-200 pb-3">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'active' 
              ? 'bg-amber-600 text-white shadow-sm' 
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          Active / Pending Batches ({batchCards.filter(c => String(c.status || '').toLowerCase() !== 'completed').length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'completed' 
              ? 'bg-amber-600 text-white shadow-sm' 
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          Completed Batches History ({batchCards.filter(c => String(c.status || '').toLowerCase() === 'completed').length})
        </button>
      </div>

      {/* BATCH CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCards.length === 0 ? (
          <div className="col-span-full py-12 text-center text-stone-400 bg-white rounded-2xl border border-stone-200">
            No batch cards found.
          </div>
        ) : (
          filteredCards.map(card => {
            const prod = goodsMap.get(String(card.good_id));
            const statusStr = String(card.status || 'Pending').toLowerCase();
            const isApproved = card.approved_by_admin;
            const isPending = statusStr === 'pending' || !card.status;
            const isInProgress = statusStr === 'in progress';
            const isCompleted = statusStr === 'completed';
            const plannedVal = Number(card.planned_units || card.planned_qty || 0);
            const actualVal = Number(card.actual_units || 0);
            const wastageVal = Number(card.wastage_units || 0);
            
            const totalProduced = actualVal + wastageVal;
            const variance = totalProduced - plannedVal;

            const productRecipes = recipeMap.get(String(card.good_id)) || [];
            const isAlreadyTransferred = packingBatches.some(p => p.batch_card_id === card.id);

            return (
              <Card key={card.id} className={`p-5 space-y-4 border-l-4 ${
                !isApproved ? 'border-purple-400 bg-purple-50/10' : isPending ? 'border-stone-400' : isInProgress ? 'border-amber-500 bg-amber-50/10' : 'border-emerald-500 bg-emerald-50/10'
              }`}>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-xs font-bold bg-stone-100 text-stone-800 px-2 py-0.5 rounded">
                      {card.batch_number}
                    </span>
                    <h3 className="font-bold text-stone-900 text-base mt-1">
                      {prod?.product_code ? `${prod.product_code} — ${prod.product_name}` : (prod?.product_name || 'Bakery Item')}
                    </h3>
                  </div>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase ${
                    !isApproved ? 'bg-purple-100 text-purple-800' : isPending ? 'bg-stone-200 text-stone-700' : isInProgress ? 'bg-amber-100 text-amber-800 animate-pulse' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {!isApproved ? 'Needs Approval' : card.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-white p-3 rounded-xl border border-stone-200">
                  <div>
                    <span className="text-stone-400 block text-[10px]">Planned Units</span>
                    <span className="font-mono font-bold text-stone-800 text-sm">{plannedVal}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">Assigned Staff</span>
                    <span className="font-bold text-amber-800">{card.bakers_assigned || 'Unassigned'}</span>
                  </div>
                </div>

                {isCompleted ? (
                  <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 text-xs space-y-2">
                    <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <BarChart3 className="h-4 w-4 text-emerald-700" /> Production Results & Variance:
                    </p>
                    <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-emerald-100">
                      <div>
                        <span className="text-stone-400 block text-[10px]">Actual Production</span>
                        <span className="font-mono font-bold text-emerald-700 text-sm">{actualVal} Units</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px]">Wastage</span>
                        <span className="font-mono font-bold text-red-600 text-sm">{wastageVal} Units</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-[11px] pt-1">
                      <span className="text-stone-600">Variance (Total vs Planned):</span>
                      <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                        variance >= 0 ? 'bg-emerald-200 text-emerald-900' : 'bg-red-100 text-red-800'
                      }`}>
                        {variance >= 0 ? `+${variance}` : variance} Units
                      </span>
                    </div>
                    {card.notes && <p className="text-stone-500 italic text-[11px] pt-1 border-t border-emerald-100">Notes: {card.notes}</p>}
                    
                    {/* Transfer to Packing Button */}
                    <div className="pt-2 border-t flex justify-end">
                      {!isAlreadyTransferred ? (
                        <Button 
                          onClick={() => handleTransferToPacking(card)}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs py-2 font-bold flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" /> Transfer to Packing
                        </Button>
                      ) : (
                        <span className="w-full text-center text-[11px] bg-emerald-200 text-emerald-900 font-bold py-1.5 rounded">
                          ✓ Transferred to Packing
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1.5">
                    <p className="text-[11px] font-bold text-stone-700 flex items-center gap-1.5">
                      <ChefHat className="h-3.5 w-3.5 text-amber-600" /> Required Recipe Ingredients:
                    </p>
                    {productRecipes.length === 0 ? (
                      <p className="text-[10px] text-stone-400 italic">No recipe configured for this item.</p>
                    ) : (
                      <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                        {productRecipes.map((r, rIdx) => {
                          const mat = matMap.get(String(r.raw_material_id));
                          const qtyPerBatch = Number(r.quantity_per_batch) || 0;
                          return (
                            <div key={rIdx} className="flex justify-between text-[11px] text-stone-700 border-b border-stone-100 pb-0.5">
                              <span>{mat?.name || mat?.material_name || 'Material'}</span>
                              <span className="font-mono font-bold text-amber-700">{qtyPerBatch.toFixed(2)} {mat?.unit || 'Kg'}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* LIVE TIMER & DURATION */}
                <div className="space-y-1 bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs">
                  <div className="flex justify-between items-center text-stone-600">
                    <span className="flex items-center gap-1 font-semibold"><Clock className="h-3.5 w-3.5 text-amber-600" /> Duration:</span>
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {getElapsedTime(card.start_time, card.finish_time)}
                    </span>
                  </div>
                  {card.start_time && (
                    <p className="text-[10px] text-stone-400 font-mono">
                      Started at: {new Date(card.start_time).toLocaleTimeString()}
                    </p>
                  )}
                </div>

                {/* ACTIONS */}
                <div className="pt-2 border-t flex justify-end gap-2">
                  {!isApproved ? (
                    <Button 
                      onClick={() => { setCardToAssign(card); setSelectedStaffList([]); setAssignModalOpen(true); }}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs py-2 flex items-center justify-center gap-1.5"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" /> Admin: Assign Staff & Approve
                    </Button>
                  ) : isPending ? (
                    <Button 
                      onClick={() => handleStartBatch(card.id)} 
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs py-2 flex items-center justify-center gap-1.5"
                    >
                      <Play className="h-3.5 w-3.5" /> Start Production
                    </Button>
                  ) : isInProgress ? (
                    <Button 
                      onClick={() => { setSelectedCard(card); setFinishModalOpen(true); }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2 flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Finish & Record Results
                    </Button>
                  ) : (
                    <span className="text-xs text-stone-400 italic w-full text-center py-1">Batch Completed</span>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* MODAL 1: ADMIN APPROVE & ASSIGN STAFF */}
      <Modal open={assignModalOpen} onClose={() => setAssignModalOpen(false)} title={`Approve & Assign Staff: ${cardToAssign?.batch_number}`}>
        <div className="space-y-4 text-xs">
          <div className="bg-stone-50 p-3 rounded-xl border space-y-1">
            <p className="font-bold text-stone-800">Planned Units: <span className="font-mono text-amber-700">{cardToAssign?.planned_units || cardToAssign?.planned_qty}</span></p>
            <p className="text-stone-500">Select staff members for this batch:</p>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 border border-stone-200 p-3 rounded-xl bg-white">
            {employees.length === 0 ? (
              <p className="text-stone-400 italic text-center py-4">No employees registered.</p>
            ) : (
              employees.map(emp => {
                const isSelected = selectedStaffList.includes(emp.full_name);
                return (
                  <div 
                    key={emp.id} 
                    onClick={() => toggleStaffSelection(emp.full_name)}
                    className={`flex justify-between items-center p-2.5 rounded-xl cursor-pointer border transition-colors ${
                      isSelected ? 'bg-amber-50 border-amber-500 font-bold text-amber-900' : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <div>
                      <span>{emp.full_name}</span>
                      <span className="text-[10px] text-stone-400 ml-2 font-mono">({emp.role})</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${isSelected ? 'bg-amber-600 text-white' : 'bg-stone-200 text-stone-600'}`}>
                      {isSelected ? 'Selected' : 'Select'}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setAssignModalOpen(false)}>Cancel</Button>
            <Button onClick={handleApproveBatch} className="bg-purple-600 hover:bg-purple-700 text-white">
              Approve & Assign
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: FINISH BATCH & RECORD ACTUALS / WASTAGE */}
      <Modal open={finishModalOpen} onClose={() => setFinishModalOpen(false)} title={`Complete Batch: ${selectedCard?.batch_number}`}>
        <div className="space-y-4">
          <div className="bg-stone-50 p-3 rounded-xl border text-xs space-y-1">
            <p className="font-bold text-stone-800">Planned Units: <span className="font-mono text-amber-700">{selectedCard?.planned_units || selectedCard?.planned_qty}</span></p>
            <p className="text-stone-500">Duration: <span className="font-mono font-bold">{getElapsedTime(selectedCard?.start_time, new Date().toISOString())}</span></p>
          </div>

          <Input 
            label="Actual Production Units" 
            type="number" 
            value={actualUnits} 
            onChange={(v) => setActualUnits(v)} 
            placeholder="e.g. 480" 
          />

          <Input 
            label="Wastage / Damaged Units" 
            type="number" 
            value={wastageUnits} 
            onChange={(v) => setWastageUnits(v)} 
            placeholder="e.g. 20" 
          />

          <Input 
            label="Remarks / Notes" 
            value={finishNotes} 
            onChange={(v) => setFinishNotes(v)} 
            placeholder="Optional notes" 
          />

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setFinishModalOpen(false)}>Cancel</Button>
            <Button onClick={handleFinishBatch} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {submitting ? 'Saving...' : 'Confirm & Complete'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: CREATE MANUAL BATCH CARD */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title="Create New Production Batch Card">
        <div className="space-y-4">
          <Input 
            label="Batch Number" 
            value={newCard.batch_number} 
            onChange={(v) => setNewCard({ ...newCard, batch_number: v })} 
          />

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Select Product</label>
            <select 
              value={newCard.good_id}
              onChange={(e) => setNewCard({ ...newCard, good_id: e.target.value })}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm bg-white font-bold"
            >
              <option value="">-- Choose Product --</option>
              {goods.map(g => (
                <option key={String(g.good_id || g.id)} value={String(g.good_id || g.id)}>
                  {g.product_code ? `${g.product_code} — ${g.product_name}` : g.product_name}
                </option>
              ))}
            </select>
          </div>

          <Input 
            label="Planned Units" 
            type="number" 
            value={newCard.planned_units} 
            onChange={(v) => setNewCard({ ...newCard, planned_units: v })} 
            placeholder="e.g. 500" 
          />

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="secondary" onClick={() => setAddModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCard} className="bg-amber-600 hover:bg-amber-700 text-white">
              Create Batch Card
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}