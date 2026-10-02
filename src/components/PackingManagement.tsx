import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, Button, Spinner, Modal } from '@/components/ui';
import { PackageCheck, Users, PackagePlus } from 'lucide-react';

export default function PackingManagement() {
  const [packingBatches, setPackingBatches] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [goods, setGoods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedPackingBatch, setSelectedPackingBatch] = useState<any>(null);
  const [selectedPacker, setSelectedPacker] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [packRes, empRes, gRes] = await Promise.all([
        supabase.from('bakery_packing_batches').select('*').order('id', { ascending: false }),
        supabase.from('bakery_employees').select('*'),
        supabase.from('bakery_goods').select('*')
      ]);

      setPackingBatches(packRes.data || []);
      setEmployees(empRes.data || []);
      setGoods(gRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const goodsMap = new Map(goods.map(g => [String(g.good_id || g.id), g]));

  const handleAssignPackerSubmit = async () => {
    if (!selectedPacker || !selectedPackingBatch) {
      alert('Please select a packer.');
      return;
    }

    try {
      const { error } = await supabase
        .from('bakery_packing_batches')
        .update({ assigned_packer: selectedPacker, status: 'Assigned' })
        .eq('id', selectedPackingBatch.id);

      if (error) throw error;
      alert('Packer assigned successfully!');
      setAssignModalOpen(false);
      setSelectedPackingBatch(null);
      setSelectedPacker('');
      fetchData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleTransferToFinishedGoods = async (pBatch: any) => {
    try {
      const packedQty = Number(pBatch.packed_units || pBatch.planned_units || 0);
      const goodId = pBatch.good_id;

      if (packedQty <= 0) {
        alert('No packed quantity available to transfer.');
        return;
      }

      const { error: batchErr } = await supabase
        .from('bakery_finished_goods_batches')
        .insert({
          good_id: parseInt(goodId) || 0,
          batch_number: String(pBatch.batch_number),
          production_date: new Date().toISOString().split('T')[0],
          initial_quantity: packedQty,
          remaining_quantity: packedQty
        });

      if (batchErr) throw batchErr;

      const { error: updateErr } = await supabase
        .from('bakery_packing_batches')
        .update({ status: 'Transferred to Finished Goods' })
        .eq('id', pBatch.id);

      if (updateErr) throw updateErr;

      alert(`Success! Transferred ${packedQty} units to Finished Goods.`);
      fetchData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  if (loading) return <Spinner />;

  const activeQueue = packingBatches.filter(p => p.status !== 'Transferred to Finished Goods');

  return (
    <div className="space-y-8 pb-12">
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
          <PackageCheck className="h-6 w-6 text-amber-600" /> Packing Management
        </h1>
        <p className="text-xs text-stone-500 mt-0.5">Manage packing batches and transfer finished goods to the factory store.</p>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-stone-200 space-y-4">
        <h2 className="text-sm font-bold text-stone-800 border-b pb-2">Active Packing Queue ({activeQueue.length})</h2>

        {activeQueue.length === 0 ? (
          <p className="text-xs text-stone-400 text-center py-12">No active packing batches found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeQueue.map(p => {
              const prod = goodsMap.get(String(p.good_id));
              const pName = prod?.product_code ? `${prod.product_code} — ${prod.product_name}` : (prod?.product_name || 'Bakery Item');
              const isCompleted = p.status === 'Completed';

              return (
                <div key={p.id} className="p-4 rounded-xl border bg-stone-50 space-y-3 text-xs shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border">{p.batch_number}</span>
                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${
                      isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>{p.status}</span>
                  </div>

                  <div>
                    <p className="font-bold text-stone-900 text-sm">{pName}</p>
                    <p className="text-stone-600 mt-1">Packed: <strong className="text-emerald-700">{p.packed_units || p.planned_units || 0}</strong> | Wastage: <strong className="text-red-600">{p.wastage_units || 0}</strong></p>
                    <p className="text-stone-600 mt-0.5">Packer: <strong className="text-purple-700">{p.assigned_packer || 'Unassigned'}</strong></p>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t gap-2">
                    <Button 
                      onClick={() => { setSelectedPackingBatch(p); setAssignModalOpen(true); }}
                      variant="secondary"
                      className="text-[10px] py-1 px-2 text-amber-800 bg-white border"
                    >
                      Change Packer
                    </Button>

                    {isCompleted && (
                      <Button 
                        onClick={() => handleTransferToFinishedGoods(p)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] py-1.5 px-3 font-bold flex items-center gap-1"
                      >
                        <PackagePlus className="h-3.5 w-3.5" /> Transfer to Finished Goods
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={assignModalOpen} onClose={() => setAssignModalOpen(false)} title="Assign Packer">
        <div className="space-y-4 text-xs">
          <select 
            value={selectedPacker}
            onChange={(e) => setSelectedPacker(e.target.value)}
            className="w-full border rounded-xl px-3 py-2 text-xs bg-white font-bold"
          >
            <option value="">-- Choose Staff Member --</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.full_name}>{emp.full_name} ({emp.role})</option>
            ))}
          </select>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="secondary" onClick={() => setAssignModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignPackerSubmit} className="bg-amber-600 text-white font-bold">Assign</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}