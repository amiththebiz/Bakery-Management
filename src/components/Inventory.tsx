import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Boxes, PlusCircle, FileText, X, Calendar, ArrowUpRight, Edit3, Trash2, ShieldCheck, Lock, Users, Truck, TrendingUp, Package } from 'lucide-react';
import { formatLKR } from '../lib/format';

export default function Inventory() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'suppliers'>('inventory');
  
  const [materials, setMaterials] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin Mode State
  const [isAdmin, setIsAdmin] = useState(true);
  
  // Modals state
  const [showGRNModal, setShowGRNModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItemForLedger, setSelectedItemForLedger] = useState<any>(null);

  // Edit Material State
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('Kg');
  const [editBuffer, setEditBuffer] = useState('');

  // Date Filter State for Ledger
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // New Material Form State
  const [newMatName, setNewMatName] = useState('');
  const [newMatUnit, setNewMatUnit] = useState('Kg');
  const [newMatBuffer, setNewMatBuffer] = useState('');
  const [newMatCost, setNewMatCost] = useState('');

  // New Supplier Form State
  const [suppName, setSuppName] = useState('');
  const [suppContact, setSuppContact] = useState('');
  const [suppPhone, setSuppPhone] = useState('');
  const [suppAddress, setSuppAddress] = useState('');

  // GRN Form State
  const [grnNumber, setGrnNumber] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [grnDate, setGrnDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [grnQty, setGrnQty] = useState('');
  const [unitCost, setUnitCost] = useState('');

  // Fetch Materials and Suppliers from Supabase Database
  const fetchData = async () => {
    setLoading(true);
    
    // Fetch Materials
    const { data: matData, error: matError } = await supabase
      .from('bakery_raw_materials')
      .select('*')
      .order('material_id', { ascending: true });
    
    if (matError) console.error('Material Error:', matError);
    else setMaterials(matData || []);

    // Fetch Suppliers
    const { data: suppData, error: suppError } = await supabase
      .from('bakery_suppliers')
      .select('*')
      .order('supplier_id', { ascending: true });
    
    if (suppError) {
      console.error('Supplier Table might not exist yet:', suppError);
    } else {
      setSuppliers(suppData || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // මුළු ස්ටොක් එකේ මුදල්මය වටිනාකම ස්වයංක්‍රීයව ගණනය කිරීම (අලුතින් එකතු කළ කොටස)
  const totalStockValue = useMemo(() => {
    return materials.reduce((sum, mat) => {
      const qty = Number(mat.current_stock || 0);
      const unitCost = Number(mat.unit_cost || 0);
      return sum + (qty * unitCost);
    }, 0);
  }, [materials]);

  const totalItemsCount = materials.length;

  // Add Material to Database
  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatName) return;

    const { error } = await supabase
      .from('bakery_raw_materials')
      .insert([
        {
          material_name: newMatName,
          unit: newMatUnit,
          current_stock: 0,
          buffer_stock_level: parseFloat(newMatBuffer) || 0,
          unit_cost: parseFloat(newMatCost) || 0
        }
      ]);

    if (error) {
      alert('Error: ' + error.message);
    } else {
      alert('Raw Material Added Successfully!');
      setShowMaterialModal(false);
      setNewMatName('');
      setNewMatBuffer('');
      setNewMatCost('');
      fetchData();
    }
  };

  // Add Supplier to Database
  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suppName) return;

    const { error } = await supabase
      .from('bakery_suppliers')
      .insert([
        {
          supplier_name: suppName,
          contact_person: suppContact,
          phone: suppPhone,
          address: suppAddress
        }
      ]);

    if (error) {
      alert('Error saving supplier. Make sure bakery_suppliers table exists in Supabase: ' + error.message);
    } else {
      alert('Supplier Registered Successfully in Database!');
      setShowSupplierModal(false);
      setSuppName('');
      setSuppContact('');
      setSuppPhone('');
      setSuppAddress('');
      fetchData();
    }
  };

  // Delete Supplier (Admin Only)
  const handleDeleteSupplier = async (supplierId: number, supplierName: string) => {
    if (!isAdmin) {
      alert('Access Denied: Admin privileges required!');
      return;
    }
    if (!confirm(`Are you sure you want to delete supplier "${supplierName}"?`)) return;

    const { error } = await supabase
      .from('bakery_suppliers')
      .delete()
      .eq('supplier_id', supplierId);

    if (error) {
      alert('Delete Failed: ' + error.message);
    } else {
      alert('Supplier deleted successfully!');
      fetchData();
    }
  };

  // Handle Edit Material (Admin Only)
  const handleUpdateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Access Denied!');
      return;
    }
    if (!editingMaterial) return;

    const { error } = await supabase
      .from('bakery_raw_materials')
      .update({
        material_name: editName,
        unit: editUnit,
        buffer_stock_level: parseFloat(editBuffer) || 0
      })
      .eq('material_id', editingMaterial.material_id);

    if (error) {
      alert('Update Failed: ' + error.message);
    } else {
      alert('Material Updated Successfully!');
      setShowEditModal(false);
      setEditingMaterial(null);
      fetchData();
    }
  };

  // Handle Delete Material (Admin Only)
  const handleDeleteMaterial = async (materialId: number, materialName: string) => {
    if (!isAdmin) {
      alert('Access Denied!');
      return;
    }
    if (!confirm(`Are you sure you want to delete "${materialName}"?`)) return;

    const { error } = await supabase
      .from('bakery_raw_materials')
      .delete()
      .eq('material_id', materialId);

    if (error) {
      alert('Delete Failed: ' + error.message);
    } else {
      alert('Material deleted successfully!');
      fetchData();
    }
  };

  // Save GRN with FIFO Batch Tracking
  const handleGRNSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial || !grnQty || !selectedSupplier) return;

    const matId = parseInt(selectedMaterial);
    const addQty = parseFloat(grnQty);
    const targetMat = materials.find(m => m.material_id === matId);
    const targetSupp = suppliers.find(s => s.supplier_id.toString() === selectedSupplier);
    
    if (!targetMat) return;

    const newStock = Number(targetMat.current_stock || 0) + addQty;
    const newCost = parseFloat(unitCost) > 0 ? parseFloat(unitCost) : targetMat.unit_cost;

    const { error } = await supabase
      .from('bakery_raw_materials')
      .update({ 
        current_stock: newStock,
        unit_cost: newCost 
      })
      .eq('material_id', matId);

    if (error) {
      alert('GRN Update Failed: ' + error.message);
    } else {
      const newTx = {
        id: Date.now(),
        material_id: matId,
        type: 'GRN (FIFO Batch In)',
        refNumber: grnNumber || `GRN-${Math.floor(1000 + Math.random() * 9000)}`,
        source: targetSupp ? targetSupp.supplier_name : 'Supplier',
        date: grnDate,
        inQty: addQty,
        outQty: 0,
        unitCost: newCost,
        runningBalance: newStock
      };
      setTransactions([newTx, ...transactions]);

      alert(`GRN Saved! Supplier: ${targetSupp?.supplier_name} | Batch Cost: Rs. ${newCost.toFixed(2)}`);
      setShowGRNModal(false);
      setGrnNumber('');
      setSelectedSupplier('');
      setGrnQty('');
      setUnitCost('');
      setSelectedMaterial('');
      fetchData();
    }
  };

  const filteredTransactions = selectedItemForLedger ? transactions.filter(tx => {
    if (tx.material_id !== selectedItemForLedger.material_id) return false;
    if (startDate && tx.date < startDate) return false;
    if (endDate && tx.date > endDate) return false;
    return true;
  }) : [];

  return (
    <div className="space-y-6">
      {/* මුළු ස්ටොක් එකේ මුදල්මය වටිනාකම පෙන්වන Summary Cards (අලුතින් එකතු කළ කොටස) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white p-6 rounded-2xl shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-amber-400 font-bold">මුළු ස්ටොක් එකේ මුදල්මය වටිනාකම</p>
            <p className="text-3xl font-mono font-extrabold mt-1 text-amber-400">{formatLKR(totalStockValue)}</p>
            <p className="text-xs text-stone-400 mt-1">සමස්ත ඉන්වෙන්ටරි අයිටම් සඳහා වැය වූ මුළු වටිනාකම</p>
          </div>
          <div className="bg-stone-800 p-4 rounded-xl border border-stone-700">
            <TrendingUp className="h-8 w-8 text-amber-400" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-stone-500 font-bold">මුළු අයිටම් වර්ග ගණන</p>
            <p className="text-3xl font-mono font-extrabold mt-1 text-stone-800">{totalItemsCount}</p>
            <p className="text-xs text-stone-400 mt-1">ඉන්වෙන්ටරිහි ලියාපදිංචි අමුද්‍රව්‍ය ප්‍රමාණය</p>
          </div>
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
            <Package className="h-8 w-8 text-amber-600" />
          </div>
        </div>
      </div>

      {/* Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-stone-800">Inventory & Supplier Management</h2>
            <button 
              onClick={() => setIsAdmin(!isAdmin)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                isAdmin ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-stone-200 text-stone-700'
              }`}
            >
              {isAdmin ? <ShieldCheck className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              <span>{isAdmin ? 'Admin Mode (Active)' : 'Staff Mode'}</span>
            </button>
          </div>
          <p className="text-sm text-stone-500">Manage Raw Materials, Supplier Database, GRNs & FIFO Batch Stock.</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-stone-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'inventory' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
          >
            📦 Inventory Stock
          </button>
          <button 
            onClick={() => setActiveTab('suppliers')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'suppliers' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
          >
            🚚 Supplier Registry ({suppliers.length})
          </button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex justify-end gap-2">
        {activeTab === 'inventory' ? (
          <>
            {isAdmin && (
              <button 
                onClick={() => setShowMaterialModal(true)}
                className="bg-stone-800 hover:bg-stone-900 text-white font-medium px-4 py-2 rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Boxes className="h-4 w-4" />
                <span>+ Add Raw Material</span>
              </button>
            )}
            <button 
              onClick={() => setShowGRNModal(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2 rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <PlusCircle className="h-4 w-4" />
              <span>+ Create GRN (Batch In)</span>
            </button>
          </>
        ) : (
          isAdmin && (
            <button 
              onClick={() => setShowSupplierModal(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2 rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Truck className="h-4 w-4" />
              <span>+ Register New Supplier</span>
            </button>
          )
        )}
      </div>

      {/* TAB 1: INVENTORY TABLE */}
      {activeTab === 'inventory' && (
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-stone-100 font-bold text-stone-700 flex items-center justify-between">
            <span>Raw Materials Database (FIFO & Stock Control)</span>
            <span className="text-xs font-normal text-stone-400">Total Items: {materials.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase font-mono text-xs">
                  <th className="p-4">ID</th>
                  <th className="p-4">Material Name</th>
                  <th className="p-4">Unit</th>
                  <th className="p-4">Current Stock</th>
                  <th className="p-4">Buffer Limit</th>
                  <th className="p-4">Latest / FIFO Cost</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-stone-400">Loading database records...</td>
                  </tr>
                ) : materials.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-stone-400">No records found.</td>
                  </tr>
                ) : (
                  materials.map((mat) => (
                    <tr key={mat.material_id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="p-4 font-mono text-stone-400">#{mat.material_id}</td>
                      <td className="p-4 font-bold text-stone-800">{mat.material_name}</td>
                      <td className="p-4 text-stone-600">{mat.unit}</td>
                      <td className="p-4 font-mono font-semibold text-stone-800">{mat.current_stock} {mat.unit}</td>
                      <td className="p-4 font-mono text-stone-500">{mat.buffer_stock_level} {mat.unit}</td>
                      <td className="p-4 font-mono font-bold text-amber-700">Rs. {Number(mat.unit_cost || 0).toFixed(2)}</td>
                      <td className="p-4 text-right flex items-center justify-end gap-2">
                        <button 
                          onClick={() => { setSelectedItemForLedger(mat); setStartDate(''); setEndDate(''); }}
                          className="bg-stone-100 hover:bg-amber-100 hover:text-amber-800 text-stone-700 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>Ledger</span>
                        </button>
                        {isAdmin && (
                          <>
                            <button 
                              onClick={() => {
                                setEditingMaterial(mat);
                                setEditName(mat.material_name);
                                setEditUnit(mat.unit);
                                setEditBuffer(mat.buffer_stock_level || '');
                                setShowEditModal(true);
                              }}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-700 p-1.5 rounded-xl transition-colors"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteMaterial(mat.material_id, mat.material_name)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded-xl transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SUPPLIERS REGISTRY TABLE */}
      {activeTab === 'suppliers' && (
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-stone-100 font-bold text-stone-700 flex items-center justify-between">
            <span>Registered Suppliers Database</span>
            <span className="text-xs font-normal text-stone-400">Total Suppliers: {suppliers.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase font-mono text-xs">
                  <th className="p-4">ID</th>
                  <th className="p-4">Supplier / Company Name</th>
                  <th className="p-4">Contact Person</th>
                  <th className="p-4">Phone Number</th>
                  <th className="p-4">Address</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-stone-400">
                      No suppliers registered yet. Click "+ Register New Supplier" to add one.
                    </td>
                  </tr>
                ) : (
                  suppliers.map((supp) => (
                    <tr key={supp.supplier_id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="p-4 font-mono text-stone-400">#{supp.supplier_id}</td>
                      <td className="p-4 font-bold text-stone-800 flex items-center gap-2">
                        <Truck className="h-4 w-4 text-amber-600" />
                        {supp.supplier_name}
                      </td>
                      <td className="p-4 text-stone-600">{supp.contact_person || '-'}</td>
                      <td className="p-4 font-mono text-stone-600">{supp.phone || '-'}</td>
                      <td className="p-4 text-stone-500 text-xs">{supp.address || '-'}</td>
                      <td className="p-4 text-right">
                        {isAdmin && (
                          <button 
                            onClick={() => handleDeleteSupplier(supp.supplier_id, supp.supplier_name)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded-xl transition-colors ml-auto flex items-center gap-1 text-xs"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showSupplierModal && isAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-stone-800">Register New Supplier</h3>
              <button onClick={() => setShowSupplierModal(false)} className="text-stone-400 hover:text-stone-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Supplier / Company Name</label>
                <input 
                  type="text"
                  value={suppName}
                  onChange={(e) => setSuppName(e.target.value)}
                  placeholder="e.g. Ceylon Flour Mills PLC"
                  required
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Contact Person</label>
                <input 
                  type="text"
                  value={suppContact}
                  onChange={(e) => setSuppContact(e.target.value)}
                  placeholder="e.g. Mr. Kamal Perera"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Phone Number</label>
                <input 
                  type="text"
                  value={suppPhone}
                  onChange={(e) => setSuppPhone(e.target.value)}
                  placeholder="e.g. 0112345678"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Address</label>
                <textarea 
                  value={suppAddress}
                  onChange={(e) => setSuppAddress(e.target.value)}
                  placeholder="Supplier office/warehouse address"
                  rows={2}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowSupplierModal(false)} className="px-4 py-2 text-stone-600 text-sm">Cancel</button>
                <button type="submit" className="bg-amber-600 text-white px-5 py-2 rounded-xl text-sm">Save Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GRN Modal with Registered Supplier Selector */}
      {showGRNModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-stone-800">Create GRN (FIFO Batch In)</h3>
                <p className="text-xs text-stone-500">Select registered supplier and record batch cost.</p>
              </div>
              <button onClick={() => setShowGRNModal(false)} className="text-stone-400 hover:text-stone-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleGRNSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">GRN Batch Number</label>
                  <input 
                    type="text"
                    value={grnNumber}
                    onChange={(e) => setGrnNumber(e.target.value)}
                    placeholder="GRN-001"
                    required
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Date</label>
                  <input 
                    type="date"
                    value={grnDate}
                    onChange={(e) => setGrnDate(e.target.value)}
                    required
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Select Registered Supplier</label>
                <select 
                  value={selectedSupplier} 
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  required
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.supplier_id} value={s.supplier_id}>
                      {s.supplier_name} ({s.phone || 'No phone'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Select Material from Database</label>
                <select 
                  value={selectedMaterial} 
                  onChange={(e) => setSelectedMaterial(e.target.value)}
                  required
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
                >
                  <option value="">-- Choose Material --</option>
                  {materials.map(m => (
                    <option key={m.material_id} value={m.material_id}>
                      {m.material_name} (Stock: {m.current_stock} {m.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Quantity Received (+)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={grnQty} 
                    onChange={(e) => setGrnQty(e.target.value)}
                    placeholder="100"
                    required
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Batch Unit Cost (LKR)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={unitCost} 
                    onChange={(e) => setUnitCost(e.target.value)}
                    placeholder="220"
                    required
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowGRNModal(false)} className="px-4 py-2 text-stone-600 text-sm">Cancel</button>
                <button type="submit" className="bg-amber-600 text-white px-5 py-2 rounded-xl text-sm">Save Batch & Update DB</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Material Modal */}
      {showMaterialModal && isAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-stone-800">Add Raw Material (Admin)</h3>
              <button onClick={() => setShowMaterialModal(false)} className="text-stone-400 hover:text-stone-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddMaterial} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Material Name</label>
                <input 
                  type="text"
                  value={newMatName}
                  onChange={(e) => setNewMatName(e.target.value)}
                  placeholder="e.g. Yeast"
                  required
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Unit</label>
                  <select 
                    value={newMatUnit}
                    onChange={(e) => setNewMatUnit(e.target.value)}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="Kg">Kg</option>
                    <option value="g">g</option>
                    <option value="packets">packets</option>
                    <option value="Liters">Liters</option>
                    <option value="units">units</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Buffer Limit</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={newMatBuffer}
                    onChange={(e) => setNewMatBuffer(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Initial Unit Cost (LKR)</label>
                <input 
                  type="number"
                  step="0.01"
                  value={newMatCost}
                  onChange={(e) => setNewMatCost(e.target.value)}
                  placeholder="e.g. 250"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowMaterialModal(false)} className="px-4 py-2 text-stone-600 text-sm">Cancel</button>
                <button type="submit" className="bg-stone-800 text-white px-5 py-2 rounded-xl text-sm">Save to DB</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Material Modal */}
      {showEditModal && isAdmin && editingMaterial && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-stone-800">Edit Raw Material (Admin)</h3>
              <button onClick={() => setShowEditModal(false)} className="text-stone-400 hover:text-stone-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateMaterial} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">Material Name</label>
                <input 
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Unit</label>
                  <select 
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
                  >
                    <option value="Kg">Kg</option>
                    <option value="g">g</option>
                    <option value="packets">packets</option>
                    <option value="Liters">Liters</option>
                    <option value="units">units</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Buffer Limit</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={editBuffer}
                    onChange={(e) => setEditBuffer(e.target.value)}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-stone-600 text-sm">Cancel</button>
                <button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm">Update Material</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ledger Modal */}
      {selectedItemForLedger && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-stone-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-stone-800">FIFO Batch Ledger: {selectedItemForLedger.material_name}</h3>
                <p className="text-xs text-stone-500">Track supplier batches, In/Out movements, and balance.</p>
              </div>
              <button onClick={() => setSelectedItemForLedger(null)} className="text-stone-400 hover:text-stone-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-stone-500" />
                <span className="text-xs font-bold text-stone-700">Time Frame Filter:</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-stone-500">From:</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded-lg px-2 py-1 text-xs" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-stone-500">To:</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded-lg px-2 py-1 text-xs" />
              </div>
              {(startDate || endDate) && (
                <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-xs text-amber-600 font-semibold ml-auto">Clear Dates</button>
              )}
            </div>

            <div className="overflow-x-auto border border-stone-200 rounded-xl">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-stone-100 border-b border-stone-200 text-stone-600">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Batch / Ref</th>
                    <th className="p-3">Supplier Name</th>
                    <th className="p-3 text-amber-700">Batch Cost</th>
                    <th className="p-3 text-green-700">In (+)</th>
                    <th className="p-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-stone-400 font-sans">
                        No batch records found for this time frame.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-stone-50">
                        <td className="p-3 text-stone-600">{tx.date}</td>
                        <td className="p-3 font-bold text-amber-800 flex items-center gap-1">
                          <ArrowUpRight className="h-3 w-3 text-green-600" />
                          {tx.refNumber}
                        </td>
                        <td className="p-3 text-stone-600 font-sans">{tx.source}</td>
                        <td className="p-3 font-bold text-amber-700">Rs. {Number(tx.unitCost).toFixed(2)}</td>
                        <td className="p-3 text-green-700 font-bold">+{tx.inQty} {selectedItemForLedger.unit}</td>
                        <td className="p-3 text-right font-bold text-stone-800">{tx.runningBalance} {selectedItemForLedger.unit}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setSelectedItemForLedger(null)} className="bg-stone-800 text-white px-5 py-2 rounded-xl text-xs font-medium">Close Ledger</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}