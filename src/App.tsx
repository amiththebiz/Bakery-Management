import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button, Input } from '@/components/ui';
import Dashboard from '@/components/Dashboard';
import Inventory from '@/components/Inventory';
import Recipes from '@/components/Recipes';
import ProductionPlanning from '@/components/ProductionPlanning';
import Batches from '@/components/BatchCards';
import PackingManagement from '@/components/PackingManagement';
import FinishedGoods from '@/components/FinishedGoods';
import WastageView from './components/WastageView';
import Employees from '@/components/Employees';
import StaffPortal from '@/components/StaffPortal';
import { 
  LayoutDashboard, 
  Boxes, 
  Beaker, 
  Calendar, 
  Factory, 
  PackageCheck, 
  Package, 
  Trash2, 
  Users, 
  Smartphone, 
  LogIn, 
  Croissant 
} from 'lucide-react';

type Page = 'dashboard' | 'inventory' | 'recipes' | 'planning' | 'batches' | 'packing' | 'finished' | 'wastage' | 'employees' | 'staff-portal';

export default function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = localStorage.getItem('bakery_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [loginLoading, setLoginLoading] = useState(false);
  const [page, setPage] = useState<Page>('dashboard');

  const handleLogin = async () => {
    if (!username || !password) {
      alert('කරුණාකර පරිශීලක නම සහ මුරපදය ඇතුළත් කරන්න.');
      return;
    }
    setLoginLoading(true);
    try {
      const { data, error } = await supabase
        .from('bakery_employees')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error || !data) {
        alert('වැරදි පරිශීලක නමක් හෝ මුරපදයකි.');
        setLoginLoading(false);
        return;
      }

      setCurrentUser(data);
      localStorage.setItem('bakery_current_user', JSON.stringify(data));
      
      const role = (data.role || '').trim().toLowerCase();

      if (role === 'admin') {
        setPage('dashboard');
      } else if (role === 'supervisor') {
        setPage('batches');
      } else {
        setPage('staff-portal');
      }
    } catch (err: any) {
      alert('ලොගින් වීමේ දෝෂයකි: ' + err.message);
    }
    setLoginLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('bakery_current_user');
    setCurrentUser(null);
    setUsername('');
    setPassword('');
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-stone-200 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Croissant className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold text-stone-800">බේකරි කළමනාකරණ පද්ධතිය</h1>
            <p className="text-xs text-stone-500">Admin, Supervisor සහ සේවකයින් සඳහා වන පිවිසුම</p>
          </div>

          <div className="space-y-4 text-xs">
            <Input 
              label="පරිශීලක නම (Username)" 
              value={username} 
              onChange={setUsername} 
              placeholder="උදා: admin හෝ charith" 
            />
            <Input 
              label="මුරපදය (Password)" 
              type="password" 
              value={password} 
              onChange={setPassword} 
              placeholder="••••••" 
            />
            <Button 
              onClick={handleLogin} 
              disabled={loginLoading} 
              className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 flex items-center justify-center gap-1.5 font-bold text-sm"
            >
              <LogIn className="h-4 w-4" /> {loginLoading ? 'පරීක්ෂා කරමින් පවතී...' : 'පද්ධතියට ඇතුල් වන්න'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const role = (currentUser.role || '').trim().toLowerCase();
  const isAdmin = role === 'admin';
  const isSupervisor = role === 'supervisor';
  const isWorker = !isAdmin && !isSupervisor;

  if (isWorker) {
    return (
      <div className="min-h-screen bg-stone-50">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Croissant className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-stone-800 text-sm block">Bakery Staff Portal</span>
              <span className="text-[10px] text-amber-800 font-bold uppercase">{currentUser.full_name} ({currentUser.role})</span>
            </div>
          </div>
          <Button variant="secondary" onClick={handleLogout} className="text-xs py-1 px-2.5 text-red-600">
            ඉවත් වන්න (Logout)
          </Button>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-6">
          <StaffPortal />
        </main>
      </div>
    );
  }

  // ඔබ ඉල්ලා සිටි නිවැරදි අනුපිළිවෙල (Order) මෙහි ඇතුළත් කර ඇත
  let navItems: { id: Page; label: string; icon: any }[] = [];

  if (isAdmin) {
    navItems = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'inventory', label: 'Inventory & GRN', icon: Boxes },
      { id: 'recipes', label: 'Recipes & Costing', icon: Beaker },
      { id: 'planning', label: 'Production Planning', icon: Calendar },
      { id: 'batches', label: 'Batch Cards', icon: Factory },
      { id: 'packing', label: 'Packing Management', icon: PackageCheck },
      { id: 'finished', label: 'Finished Stock', icon: Package },
      { id: 'wastage', label: 'Waste Management', icon: Trash2 },
      { id: 'employees', label: 'Staff & Roles', icon: Users },
      { id: 'staff-portal', label: 'Staff/Salary Portal', icon: Smartphone },
    ];
  } else if (isSupervisor) {
    navItems = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'inventory', label: 'Inventory & GRN', icon: Boxes },
      { id: 'batches', label: 'Batch Cards', icon: Factory },
      { id: 'packing', label: 'Packing Management', icon: PackageCheck },
      { id: 'wastage', label: 'Waste Management', icon: Trash2 },
      { id: 'employees', label: 'Staff & Roles', icon: Users },
      { id: 'staff-portal', label: 'Staff/Salary Portal', icon: Smartphone },
    ];
  }

  const products: any[] = [];

  return (
    <div className="min-h-screen bg-stone-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-stone-200 bg-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3 border-b border-stone-200 px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <Croissant className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-bold text-stone-800">Bakery Manager</h1>
            <p className="text-[10px] text-amber-800 font-bold uppercase">Role: {currentUser.role}</p>
          </div>
        </div>

        <div className="px-6 py-3 bg-stone-50 border-b border-stone-200 text-xs">
          <span className="text-stone-400 block text-[10px]">පිවිසී සිටින්නේ:</span>
          <span className="font-bold text-stone-900">{currentUser.full_name}</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  page === item.id
                    ? 'bg-amber-50 text-amber-700'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-stone-200 p-4">
          <Button variant="secondary" onClick={handleLogout} className="w-full text-xs text-red-600 hover:bg-red-50">
            පද්ධතියෙන් ඉවත් වන්න (Logout)
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Croissant className="h-5 w-5" />
          </div>
          <div>
            <span className="font-bold text-stone-800 text-sm block">Bakery Manager</span>
            <span className="text-[9px] text-amber-800 font-bold uppercase">{currentUser.full_name} ({currentUser.role})</span>
          </div>
        </div>
        <Button variant="secondary" onClick={handleLogout} className="text-xs py-1 px-2.5 text-red-600">
          Logout
        </Button>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-stone-200 bg-white px-2 py-2 lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                page === item.id ? 'bg-amber-50 text-amber-700' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
          {page === 'dashboard' && <Dashboard onNavigate={(p) => setPage(p as Page)} />}
          {page === 'inventory' && <Inventory />}
          {page === 'recipes' && <Recipes />}
          {page === 'planning' && <ProductionPlanning />}
          {page === 'batches' && <Batches />}
          {page === 'packing' && <PackingManagement />}
          {page === 'finished' && <FinishedGoods />}
          {page === 'wastage' && <WastageView products={products} />}
          {page === 'employees' && <Employees />}
          {page === 'staff-portal' && <StaffPortal />}
        </div>
      </main>
    </div>
  );
}