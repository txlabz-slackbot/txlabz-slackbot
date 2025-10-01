"use client";
import { Bell, PlusCircle, LayoutGrid, LogOut, Home } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function UserProfile() {
  const { data: session } = useSession();
  const user = session?.user;

  if (!user) {
    return null;
  }

  const getInitials = (name) => {
    if (!name) return "";
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`;
    }
    return name.substring(0, 2);
  };

  return (
    <div className="p-4 border-t border-gray-700">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="w-full justify-start text-base px-2">
            <Avatar className="w-8 h-8 mr-2">
              <AvatarImage src={user.image} />
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <span className="font-medium">{user.name}</span>
              <span className="text-xs text-gray-400">{user.email}</span>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function Sidebar({ view, setView }) {
    return (
        <aside className="w-64 flex-col bg-[#0d1a22] text-[#f3f4f6] border-r border-gray-700 hidden md:flex">
            <div className="p-4 border-b border-gray-700">
                <h1 className="text-2xl font-semibold flex items-center gap-2 tracking-tight">
                    <Bell className="w-6 h-6 text-[#f3f4f6]" />
                    <span>TxLabz</span>
                </h1>
            </div>
            <nav className="flex-1 p-4 space-y-1">
                <Button
                    variant={view === 'home' ? 'secondary' : 'ghost'}
                    className="w-full justify-start text-base"
                    onClick={() => setView('home')}
                >
                    <Home className="w-5 h-5 mr-3" />
                    Home
                </Button>
                <Button
                    variant={view === 'view' ? 'secondary' : 'ghost'}
                    className="w-full justify-start text-base"
                    onClick={() => setView('view')}
                >
                    <LayoutGrid className="w-5 h-5 mr-3" />
                    View Reminders
                </Button>
                <Button
                    variant={view === 'create' ? 'secondary' : 'ghost'}
                    className="w-full justify-start text-base"
                    onClick={() => setView('create')}
                >
                    <PlusCircle className="w-5 h-5 mr-3" />
                    Create Reminder
                </Button>
            </nav>
            <UserProfile />
        </aside>
    );
}