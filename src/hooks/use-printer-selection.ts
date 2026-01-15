"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import {
  getPreferredPrinter,
  setPrinterPreference,
  type LabelType,
  type PrinterOption,
} from "@/lib/printer-preferences";

interface Printer extends PrinterOption {
  type: string;
  connection_type: string;
  host?: string;
  port?: number;
  agent_id?: string;
  is_active: boolean;
  dpi: number;
}

interface PrintAgent {
  id: string;
  name: string;
  status: "online" | "offline";
}

interface UsePrinterSelectionOptions {
  labelType?: LabelType;
  autoSelect?: boolean;
}

interface UsePrinterSelectionResult {
  printers: Printer[];
  agents: PrintAgent[];
  selectedPrinterId: string | undefined;
  setSelectedPrinterId: (id: string) => void;
  rememberChoice: boolean;
  setRememberChoice: (value: boolean) => void;
  savePreference: () => void;
  selectedPrinter: Printer | undefined;
  isLoading: boolean;
  isAgentOnline: (printerId: string) => boolean;
  canPrint: boolean;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * Hook for managing printer selection with workstation preferences.
 *
 * Usage:
 * ```tsx
 * const {
 *   printers,
 *   selectedPrinterId,
 *   setSelectedPrinterId,
 *   rememberChoice,
 *   setRememberChoice,
 *   savePreference,
 *   canPrint,
 * } = usePrinterSelection({ labelType: "batch" });
 * ```
 */
export function usePrinterSelection(
  options: UsePrinterSelectionOptions = {}
): UsePrinterSelectionResult {
  const { labelType, autoSelect = true } = options;

  // Fetch printers
  const { data: printersData, isLoading: loadingPrinters } = useSWR<{
    data: Printer[];
  }>("/api/printers", fetcher);

  // Fetch agents for status checking
  const { data: agentsData, isLoading: loadingAgents } = useSWR<{
    data: PrintAgent[];
  }>("/api/print-agents", fetcher);

  const printers = printersData?.data || [];
  const agents = agentsData?.data || [];

  // Selection state
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | undefined>();
  const [rememberChoice, setRememberChoice] = useState(false);

  // Auto-select preferred printer when printers load
  useEffect(() => {
    if (autoSelect && printers.length > 0 && !selectedPrinterId) {
      const preferred = getPreferredPrinter(printers, labelType);
      if (preferred) {
        setSelectedPrinterId(preferred.id);
      }
    }
  }, [printers, labelType, autoSelect, selectedPrinterId]);

  // Get the selected printer object
  const selectedPrinter = printers.find((p) => p.id === selectedPrinterId);

  // Check if an agent is online for a given printer
  const isAgentOnline = useCallback(
    (printerId: string): boolean => {
      const printer = printers.find((p) => p.id === printerId);
      if (!printer || printer.connection_type !== "agent") return true;

      const agent = agents.find((a) => a.id === printer.agent_id);
      return agent?.status === "online";
    },
    [printers, agents]
  );

  // Can print check
  const canPrint =
    !!selectedPrinter &&
    (selectedPrinter.connection_type !== "agent" || isAgentOnline(selectedPrinter.id));

  // Save the current selection as workstation preference
  const savePreference = useCallback(() => {
    if (selectedPrinterId && rememberChoice) {
      setPrinterPreference(selectedPrinterId, labelType);
    }
  }, [selectedPrinterId, rememberChoice, labelType]);

  return {
    printers,
    agents,
    selectedPrinterId,
    setSelectedPrinterId,
    rememberChoice,
    setRememberChoice,
    savePreference,
    selectedPrinter,
    isLoading: loadingPrinters || loadingAgents,
    isAgentOnline,
    canPrint,
  };
}

export default usePrinterSelection;
