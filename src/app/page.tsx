"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  BotMessageSquare,
  CheckCircle2,
  Copy,
  Loader2,
  Send,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

const TEAMS = ["TOM", "ANA", "DIANA"];
const MAX_CHARS = 4000;

interface Prompt {
  id: string;
  team: string;
  text: string;
  created_at: string;
  marked?: boolean;
}

export default function Home() {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const endOfListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { error } = await supabase.from("prompts").select("id").limit(1);
        setIsConnected(!error);
      } catch {
        setIsConnected(false);
      }
    };

    checkConnection();
  }, []);

  useEffect(() => {
    if (!selectedTeam) return;

    const fetchPrompts = async () => {
      const { data } = await supabase
        .from("prompts")
        .select("*")
        .eq("team", selectedTeam)
        .order("created_at", { ascending: true });

      if (data) setPrompts(data);
    };

    fetchPrompts();

    const channel = supabase
      .channel(`public:prompts:team=${selectedTeam}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "prompts",
          filter: `team=eq.${selectedTeam}`,
        },
        (payload) => {
          const nextPrompt = payload.new as Prompt;
          setPrompts((prev) => {
            if (prev.some((prompt) => prompt.id === nextPrompt.id)) return prev;
            return [...prev, nextPrompt];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "prompts",
          filter: `team=eq.${selectedTeam}`,
        },
        (payload) => {
          setPrompts((prev) =>
            prev.map((prompt) =>
              prompt.id === payload.new.id ? { ...prompt, ...payload.new } : prompt
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTeam]);

  useEffect(() => {
    if (!selectedTeam || prompts.length === 0) return;
    endOfListRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [prompts, selectedTeam]);

  const insertedCount = useMemo(
    () => prompts.filter((prompt) => prompt.marked).length,
    [prompts]
  );

  const handleCopy = async (prompt: Prompt) => {
    try {
      await navigator.clipboard.writeText(prompt.text);
      setCopiedId(prompt.id);
      toast.success("Prompt copiado al portapapeles");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("No se pudo copiar el prompt");
    }
  };

  const handleSubmit = async () => {
    if (!inputText.trim() || inputText.length > MAX_CHARS || !selectedTeam) return;

    setIsSubmitting(true);
    const text = inputText.trim();

    const { data, error } = await supabase
      .from("prompts")
      .insert([
        {
          team: selectedTeam,
          text,
        },
      ])
      .select()
      .single();

    setIsSubmitting(false);

    if (error) {
      toast.error("Error al enviar el prompt");
      return;
    }

    if (data) {
      setPrompts((prev) => [...prev, data as Prompt]);
    }

    toast.success("Prompt enviado correctamente");
    setInputText("");
  };

  if (!selectedTeam) {
    return (
      <main className="app-canvas min-h-screen px-6 py-10 text-slate-100 md:px-10">
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-10">
          <header className="soft-panel animate-rise rounded-3xl px-6 py-8 md:px-10 md:py-10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-400/20 bg-slate-900/30 px-3 py-1 text-sm font-medium text-slate-200">
              <span
                className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`}
              />
              {isConnected ? "Conectado a Supabase" : "Verificando conexion"}
            </div>
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Agentic Engineering Prompt Hub
            </h1>
            <p className="mt-4 max-w-3xl text-pretty text-base text-slate-300 md:text-lg">
              Espacio unificado para enviar prompts de cada equipo en tiempo real, con trazabilidad y confirmacion de insercion desde el panel docente.
            </p>
          </header>

          <section className="grid gap-5 md:grid-cols-3">
            {TEAMS.map((team, index) => (
              <button
                key={team}
                type="button"
                onClick={() => setSelectedTeam(team)}
                className="soft-panel animate-rise group rounded-2xl border p-6 text-left transition duration-300 hover:-translate-y-0.5 hover:border-sky-300/60 hover:shadow-[0_24px_50px_-28px_rgba(30,64,175,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="mb-6 flex items-center justify-end">
                  <span className="rounded-full border border-slate-500/40 bg-slate-800/40 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-slate-300">
                    Equipo
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-white">{team}</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Envia prompts y observa el estado de procesamiento en directo.
                </p>
              </button>
            ))}
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="app-canvas flex min-h-screen flex-col px-4 pb-4 pt-5 text-slate-100 md:px-8 md:pb-6 md:pt-6">
      <header className="soft-panel animate-rise mx-auto mb-4 flex w-full max-w-6xl items-center justify-between rounded-2xl px-4 py-3 md:px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedTeam(null)}
            className="h-9 w-9 rounded-xl border border-transparent text-slate-300 hover:border-slate-400/20 hover:bg-slate-700/20 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Canal activo</p>
            <h2 className="text-lg font-semibold text-white md:text-xl">Equipo {selectedTeam}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-900/20 px-3 py-1 text-xs font-medium text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          {insertedCount} insertados
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-hidden rounded-2xl border border-slate-300/15 bg-slate-950/35">
        <ScrollArea className="flex-1 px-4 py-4 md:px-7 md:py-6">
          {prompts.length === 0 ? (
            <div className="flex h-[52vh] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-500/35 bg-slate-900/20 text-slate-400">
              <BotMessageSquare className="mb-3 h-11 w-11 opacity-45" />
              <p className="text-sm md:text-base">Todavia no hay prompts en este equipo.</p>
            </div>
          ) : (
            <div className="space-y-4 pb-2">
              {prompts.map((prompt) => (
                <article
                  key={prompt.id}
                  className={`animate-rise rounded-2xl border px-4 py-4 shadow-sm md:px-5 ${
                    prompt.marked
                      ? "border-emerald-400/45 bg-emerald-950/20"
                      : "border-slate-500/30 bg-slate-900/35"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-slate-200 md:text-[0.92rem]">
                    {prompt.text}
                  </p>
                  <footer className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <span>
                        {new Date(prompt.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {prompt.marked ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/45 bg-emerald-950/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Insertado
                        </span>
                      ) : null}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 rounded-lg border border-slate-400/20 bg-slate-800/60 px-2.5 text-xs text-slate-200 hover:bg-slate-700/80"
                      onClick={() => handleCopy(prompt)}
                    >
                      {copiedId === prompt.id ? (
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {copiedId === prompt.id ? "Copiado" : "Copiar"}
                    </Button>
                  </footer>
                </article>
              ))}
              <div ref={endOfListRef} />
            </div>
          )}
        </ScrollArea>

        <div className="soft-panel border-x-0 border-b-0 rounded-none px-4 py-4 md:px-7 md:py-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <label htmlFor="prompt-input" className="text-sm font-semibold text-slate-300">
              Nuevo prompt
            </label>
            <span
              className={`text-xs font-medium ${
                inputText.length > MAX_CHARS ? "text-rose-400" : "text-slate-400"
              }`}
            >
              {inputText.length} / {MAX_CHARS}
            </span>
          </div>
          <div className="relative">
            <Textarea
              id="prompt-input"
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder="Escribe aqui tu prompt... (Ctrl + Enter para enviar)"
              className="min-h-[130px] resize-y rounded-xl border-slate-500/35 bg-slate-900/50 p-4 pb-14 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:ring-sky-400/30"
            />
            <div className="absolute bottom-3 right-3">
              <Button
                onClick={handleSubmit}
                disabled={!inputText.trim() || inputText.length > MAX_CHARS || isSubmitting}
                className="rounded-lg bg-sky-600 text-white shadow-lg shadow-blue-950/40 transition hover:bg-sky-500"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Enviar
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
