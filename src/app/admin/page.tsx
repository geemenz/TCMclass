"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Check,
  CheckCircle2,
  Copy,
  Inbox,
  MessageSquare,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

const TEAMS = ["TOM", "ANA", "DIANA"];

interface Prompt {
  id: string;
  team: string;
  text: string;
  created_at: string;
  marked?: boolean;
}

export default function AdminDashboard() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrompts = async () => {
      const { data } = await supabase
        .from("prompts")
        .select("*")
        .order("created_at", { ascending: false });

      if (data) setPrompts(data);
    };

    fetchPrompts();

    const channel = supabase
      .channel("public:prompts:admin")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "prompts",
        },
        (payload) => {
          const nextPrompt = payload.new as Prompt;
          setPrompts((prev) => {
            if (prev.some((prompt) => prompt.id === nextPrompt.id)) return prev;
            return [nextPrompt, ...prev];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "prompts",
        },
        (payload) => {
          setPrompts((prev) =>
            prev.map((prompt) =>
              prompt.id === payload.new.id ? { ...prompt, ...payload.new } : prompt
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "prompts",
        },
        (payload) => {
          setPrompts((prev) => prev.filter((prompt) => prompt.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const totalInserted = useMemo(
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
      toast.error("Error al copiar");
    }
  };

  const handleDeletePrompt = async (id: string) => {
    const { error } = await supabase.from("prompts").delete().eq("id", id);

    if (error) {
      toast.error("Error al borrar el prompt");
      return;
    }

    setPrompts((prev) => prev.filter((prompt) => prompt.id !== id));
    toast.success("Prompt borrado");
  };

  const handleToggleMark = async (prompt: Prompt) => {
    const nextMarked = !prompt.marked;
    const { error } = await supabase
      .from("prompts")
      .update({ marked: nextMarked })
      .eq("id", prompt.id);

    if (error) {
      toast.error("Error al marcar el prompt");
      return;
    }

    setPrompts((prev) =>
      prev.map((currentPrompt) =>
        currentPrompt.id === prompt.id ? { ...currentPrompt, marked: nextMarked } : currentPrompt
      )
    );
    toast.success(nextMarked ? "Prompt marcado como insertado" : "Prompt desmarcado");
  };

  const getTeamPrompts = (team: string) => prompts.filter((prompt) => prompt.team === team);

  return (
    <main className="app-canvas flex min-h-screen flex-col px-4 pb-4 pt-5 text-slate-100 md:px-8 md:pb-6 md:pt-6">
      <header className="soft-panel animate-rise mx-auto mb-4 flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4 md:px-7">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
            <MessageSquare className="h-6 w-6 text-sky-300" />
            Panel de administracion
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Gestion de prompts en tiempo real para los tres equipos.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-900/20 px-3 py-1.5 text-sm font-medium text-emerald-300">
          <ShieldCheck className="h-4 w-4" />
          {totalInserted} insertados de {prompts.length}
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 pb-2 md:h-[calc(100vh-170px)] md:flex-1 md:flex-row md:gap-5 md:overflow-x-auto md:pb-1">
        {TEAMS.map((team, index) => {
          const teamPrompts = getTeamPrompts(team);

          return (
            <article
              key={team}
              className="soft-panel animate-rise flex w-full min-w-0 flex-col rounded-2xl md:min-h-0 md:w-[390px] md:min-w-[340px]"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <header className="flex items-center justify-between border-b border-slate-400/15 px-4 py-3 md:px-5">
                <h2 className="text-xl font-semibold text-white">Equipo {team}</h2>
                <span className="rounded-md border border-slate-400/25 bg-slate-800/45 px-2 py-1 text-xs font-medium text-slate-300">
                  {teamPrompts.length}
                </span>
              </header>

              <ScrollArea className="h-[42vh] px-4 py-4 md:h-auto md:flex-1 md:px-5">
                {teamPrompts.length === 0 ? (
                  <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-500/35 bg-slate-900/20 text-slate-400">
                    <Inbox className="mb-2 h-8 w-8 opacity-45" />
                    <p className="text-sm">Sin prompts todavia</p>
                  </div>
                ) : (
                  <div className="space-y-3 pb-1">
                    {teamPrompts.map((prompt) => (
                      <Card
                        key={prompt.id}
                        className={`border py-0 ${
                          prompt.marked
                            ? "border-emerald-400/45 bg-emerald-950/20"
                            : "border-slate-500/30 bg-slate-950/50"
                        }`}
                      >
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-medium text-slate-400">
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

                          <p className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-slate-200">
                            {prompt.text}
                          </p>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              className={`h-7 rounded-md border px-2.5 text-xs ${
                                prompt.marked
                                  ? "border-emerald-500/40 bg-emerald-900/40 text-emerald-300 hover:bg-emerald-800/40"
                                  : "border-slate-400/25 bg-slate-800/60 text-slate-200 hover:bg-slate-700/80"
                              }`}
                              onClick={() => handleToggleMark(prompt)}
                            >
                              <Check className="mr-1.5 h-3.5 w-3.5" />
                              {prompt.marked ? "Insertado" : "Insertar"}
                            </Button>

                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-7 rounded-md border border-slate-400/25 bg-slate-800/60 px-2.5 text-xs text-slate-200 hover:bg-slate-700/80"
                              onClick={() => handleCopy(prompt)}
                            >
                              {copiedId === prompt.id ? (
                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              {copiedId === prompt.id ? "Copiado" : "Copiar"}
                            </Button>

                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 rounded-md bg-rose-900/60 px-2.5 text-xs text-rose-100 hover:bg-rose-700/80"
                              onClick={() => handleDeletePrompt(prompt.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </article>
          );
        })}
      </section>
    </main>
  );
}
