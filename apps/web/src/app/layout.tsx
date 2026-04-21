import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import AppSidebar from "@/components/app-sidebar";
import "../index.css";
import Providers from "@/components/providers";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@routes/ui/components/sidebar";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Trasy",
	description: "Mapa i udostępnianie tras GPX",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="pl" suppressHydrationWarning>
			<body
				className={`${geistSans.variable} ${geistMono.variable} bg-background antialiased`}
			>
				<Providers>
					<SidebarProvider>
						<AppSidebar />
						<SidebarInset>
							<div className="flex h-full flex-col">
								<header className="flex h-12 items-center gap-2 border-b px-3">
									<SidebarTrigger />
									<div className="text-muted-foreground text-sm">
										Trasy GPX
									</div>
								</header>
								<div className="min-h-0 flex-1">{children}</div>
							</div>
						</SidebarInset>
					</SidebarProvider>
				</Providers>
			</body>
		</html>
	);
}
