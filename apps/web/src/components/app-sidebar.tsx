"use client";

import {
	Bike,
	Link as LinkIcon,
	MapPinned,
	Plus,
	Route,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { authClient } from "@/lib/auth-client";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	SidebarSeparator,
} from "@routes/ui/components/sidebar";

const navigationItems = [
	{
		href: "/",
		label: "Mapa",
		icon: MapPinned,
		authOnly: false,
	},
	{
		href: "/routes/new",
		label: "Dodaj trasę",
		icon: Plus,
		authOnly: true,
	},
	{
		href: "/dashboard",
		label: "Moje trasy",
		icon: Route,
		authOnly: true,
	},
	{
		href: "/strava",
		label: "Połącz Strava",
		icon: LinkIcon,
		authOnly: true,
	},
] as const;

const isActivePath = (pathname: string, href: string) =>
	href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

export default function AppSidebar() {
	const pathname = usePathname();
	const { data: session } = authClient.useSession();

	return (
		<Sidebar collapsible="icon" variant="inset">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							render={<Link href="/" />}
							isActive={pathname === "/"}
							size="lg"
							tooltip="Trasy"
						>
							<Bike />
							<div className="flex min-w-0 flex-col">
								<span className="truncate font-semibold">Trasy</span>
								<span className="truncate text-muted-foreground text-xs">
									Polskie trasy GPX
								</span>
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarSeparator />
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Nawigacja</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navigationItems
								.filter((item) => !item.authOnly || session?.user)
								.map((item) => {
									const Icon = item.icon;

									return (
										<SidebarMenuItem key={item.href}>
											<SidebarMenuButton
												render={<Link href={item.href} />}
												isActive={isActivePath(pathname, item.href)}
												tooltip={item.label}
											>
												<Icon />
												<span>{item.label}</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
									);
								})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarSeparator />
			<SidebarFooter>
				<div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col">
					<ModeToggle />
					<UserMenu />
				</div>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
