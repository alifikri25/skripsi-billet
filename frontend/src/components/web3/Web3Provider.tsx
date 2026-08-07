"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider } from "connectkit";
import { config } from "@/config/wagmi";

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          customTheme={{
            "--ck-connectbutton-background": "#fc3b10",
            "--ck-connectbutton-hover-background": "#d62f0b",
            "--ck-connectbutton-color": "#ffffff",
            "--ck-connectbutton-border-radius": "0px",
            "--ck-connectbutton-font-family": "Roboto, sans-serif",
            "--ck-connectbutton-font-weight": "700",
            "--ck-connectbutton-box-shadow": "none",
          }}
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}