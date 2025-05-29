
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  FileText,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  QrCode,
  UserCircle,
  LogOut,
  Warehouse,
  Settings,
  HelpCircle,
  LayoutDashboardIcon,
  PanelLeft, // Added for clarity, though SidebarTrigger imports it
} from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  { href: '/dashboard/generate-gate-pass', label: 'Generate Gate Pass', icon: FileText },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon },
  { href: '/dashboard/products', label: 'Products', icon: Package },
  { href: '/dashboard/incoming-stock', label: 'Incoming Stock', icon: ArrowDownToLine },
  { href: '/dashboard/outgoing-stock', label: 'Outgoing Stock', icon: ArrowUpFromLine },
  { href: '/dashboard/scan-pass-id', label: 'Scan Pass ID', icon: QrCode },
];

const bottomMenuItems = [
    { href: '/dashboard/profile', label: 'Profile', icon: UserCircle },
];

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const { user, logOut } = useAuthContext();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await logOut();
    router.push('/login');
  };

  return (
    <SidebarProvider defaultOpen={false}> {/* Changed defaultOpen to false */}
      <Sidebar collapsible="icon" variant="sidebar" side="left">
        <SidebarHeader className="items-center">
            <Warehouse className="h-8 w-8 text-primary" />
            <Link href="/dashboard" className="ml-2 text-2xl font-bold text-primary group-data-[collapsible=icon]:hidden">
              StockFlow
            </Link>
        </SidebarHeader>

        <SidebarContent className="p-2">
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <Link href={item.href} legacyBehavior passHref>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    className="w-full justify-start"
                    tooltip={{ children: item.label, side: 'right', align: 'center' }}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="p-2">
           <SidebarSeparator className="my-2 group-data-[collapsible=icon]:hidden" />
           <div className="group-data-[collapsible=icon]:hidden px-2 pb-2">
                {user && (
                    <>
                        <p className="text-sm font-medium truncate">{user.email}</p>
                        <p className="text-xs text-muted-foreground">Account</p>
                    </>
                )}
            </div>

          <SidebarMenu>
             {bottomMenuItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <Link href={item.href} legacyBehavior passHref>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    className="w-full justify-start"
                    tooltip={{ children: item.label, side: 'right', align: 'center' }}
                  >
                    <item.icon className="h-5 w-5" />
                     <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleLogout}
                className="w-full justify-start"
                variant="ghost"
                 tooltip={{ children: "Log Out", side: 'right', align: 'center' }}
              >
                <LogOut className="h-5 w-5" />
                 <span className="group-data-[collapsible=icon]:hidden">Log Out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
           <div className="mt-auto flex justify-center pt-2 group-data-[collapsible=icon]:pt-0">
                <SidebarTrigger /> {/* Removed md:hidden to make it visible on desktop */}
            </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="p-4 md:p-6 lg:p-8">
         {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
