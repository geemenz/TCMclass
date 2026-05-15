"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, CheckCircle2, MessageSquare, Inbox, Trash2, Check } from "lucide-react";
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
          setPrompts((prev) => [payload.new as Prompt, ...prev]);
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
            prev.map((p) => (p.id === payload.new.id ? { ...p, ...payload.new } : p))
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
          setPrompts((prev) => prev.filter((p) => p.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCopy = async (prompt: Prompt) => {
    try {
      await navigator.clipboard.writeText(prompt.text);
      setCopiedId(prompt.id);
      toast.success("Prompt copiado al portapapeles");
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast.error("Error al copiar");
    }
  };

  const handleDeletePrompt = async (id: string) => {
    const { error } = await supabase.from('prompts').delete().eq('id', id);
    if (error) {
      toast.error('Error al borrar el prompt');
    } else {
      setPrompts((prev) => prev.filter((p) => p.id !== id));
      toast.success('Prompt borrado');
    }
  };

  const handleToggleMark = async (prompt: Prompt) => {
    const { error } = await supabase
      .from('prompts')
      .update({ marked: !prompt.marked })
      .eq('id', prompt.id);
    
    if (error) {
      toast.error('Error al marcar el prompt');
    } else {
      setPrompts((prev) =>
        prev.map((p) => (p.id === prompt.id ? { ...p, marked: !p.marked } : p))
      );
      toast.success(prompt.marked ? 'Prompt desmarcado' : 'Prompt marcado como insertado');
    }
  };

  const getTeamPrompts = (team: string) => {
    return prompts.filter((p) => p.team === team);
  };

  return (
    <main className="flex-1 flex flex-col h-screen bg-zinc-950 overflow-hidden">
      <header className="border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-xl px-6 py-4 flex items-center justify-between z-10">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-blue-500" />
            Panel de Administración
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium text-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            {prompts.length} Prompts recibidos
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-6 h-full min-w-max">
          {TEAMS.map((team) => {
            const teamPrompts = getTeamPrompts(team);
            return (
              <div key={team} className="w-96 flex flex-col h-full bg-zinc-900/50 rounded-2xl border border-zinc-800/50 overflow-hidden">
                <div className="p-4 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between sticky top-0">
                  <h2 className="font-semibold text-white flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold shadow-sm">
                      {team.charAt(0)}
                    </div>
                    Equipo {team}
                  </h2>
                  <span className="text-xs font-medium text-zinc-400 bg-zinc-800 px-2 py-1 rounded-md">
                    {teamPrompts.length}
                  </span>
                </div>
                
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {teamPrompts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-40 text-zinc-500 space-y-3">
                        <Inbox className="w-8 h-8 opacity-20" />
                        <p className="text-sm">Sin prompts todavía</p>
                      </div>
                    ) : (
                      teamPrompts.map((prompt) => (
                        <Card key={prompt.id} className={`bg-zinc-950 border-zinc-800 shadow-sm hover:border-zinc-700 transition-colors ${prompt.marked ? 'border-green-500/50 bg-green-950/20' : ''}`}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-4">
                              <span className="text-xs text-zinc-500 font-medium">
                                {new Date(prompt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <div className="flex gap-1">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className={`h-7 px-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 ${prompt.marked ? 'bg-green-900/50 hover:bg-green-800/50 text-green-400' : ''}`}
                                  onClick={() => handleToggleMark(prompt)}
                                >
                                  <Check className="w-3.5 h-3.5 mr-1.5" />
                                  {prompt.marked ? "Insertado" : "Insertar"}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-7 px-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                                  onClick={() => handleCopy(prompt)}
                                >
                                  {copiedId === prompt.id ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mr-1.5" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                                  )}
                                  {copiedId === prompt.id ? "Copiado" : "Copiar"}
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-7 px-2 text-xs bg-red-800/50 hover:bg-red-700 text-zinc-300"
                                  onClick={() => handleDeletePrompt(prompt.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
                              {prompt.text}
                            </p>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
