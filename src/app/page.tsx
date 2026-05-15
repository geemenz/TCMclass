"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, ArrowLeft, Loader2, BotMessageSquare, Copy, CheckCircle2 } from "lucide-react";
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

  useEffect(() => {
    // We check the connection to supabase
    const checkConnection = async () => {
      try {
        const { error } = await supabase.from("prompts").select("id").limit(1);
        if (!error) {
          setIsConnected(true);
        }
      } catch (err) {
        setIsConnected(false);
      }
    };
    checkConnection();

    // Subscribe to realtime changes for the selected team
    if (!selectedTeam) return;

    const fetchPrompts = async () => {
      const { data, error } = await supabase
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
            if (prev.some((prompt) => prompt.id === nextPrompt.id)) {
              return prev;
            }
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
            prev.map((p) => (p.id === payload.new.id ? { ...p, ...payload.new } : p))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTeam]);

  const handleCopy = (prompt: Prompt) => {
    navigator.clipboard.writeText(prompt.text);
    setCopiedId(prompt.id);
    toast.success("Prompt copiado al portapapeles");
    setTimeout(() => setCopiedId(null), 2000);
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
    } else {
      if (data) {
        setPrompts((prev) => [...prev, data as Prompt]);
      }
      toast.success("Prompt enviado correctamente");
      setInputText("");
    }
  };

  if (!selectedTeam) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-950">
        <div className="w-full max-w-4xl text-center space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-sm">
              <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500 animate-pulse"}`} />
              {isConnected ? "Sistema en línea" : "Conectando..."}
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
              Agentic Engineering <span className="text-blue-500">Prompt Hub</span>
            </h1>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Selecciona tu equipo para acceder al espacio de trabajo. Todos los prompts serán enviados en tiempo real al panel del instructor.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
            {TEAMS.map((team) => (
              <Card 
                key={team} 
                className="group cursor-pointer hover:border-blue-500/50 hover:bg-zinc-900/50 transition-all duration-300 bg-zinc-900 border-zinc-800"
                onClick={() => setSelectedTeam(team)}
              >
                <CardContent className="p-8 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                    {team.charAt(0)}
                  </div>
                  <h2 className="text-xl font-semibold text-zinc-100">Equipo {team}</h2>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    );
}
  

  return (
    <main className="flex-1 flex flex-col h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setSelectedTeam(null)}
            className="text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
              {selectedTeam.charAt(0)}
            </div>
            <div>
              <h2 className="font-semibold text-white">Equipo {selectedTeam}</h2>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Conectado
              </div>
            </div>
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {prompts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[40vh] text-zinc-500 space-y-4">
              <BotMessageSquare className="w-12 h-12 opacity-20" />
              <p>Aún no hay prompts en este equipo. ¡Envía el primero!</p>
            </div>
          ) : (
            prompts.map((prompt) => (
              <div key={prompt.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col">
                <p className="text-zinc-300 whitespace-pre-wrap font-mono text-sm leading-relaxed">{prompt.text}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
                  <div className="flex items-center gap-2">
                    <span>{new Date(prompt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {prompt.marked ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-green-500/40 bg-green-950/40 px-2 py-0.5 text-[11px] font-medium text-green-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Insertado
                      </span>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
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
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="p-6 bg-zinc-950 border-t border-zinc-800">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex items-center justify-between px-1">
            <label className="text-sm font-medium text-zinc-400">Nuevo Prompt</label>
            <span className={`text-xs ${inputText.length > MAX_CHARS ? 'text-red-500 font-bold' : 'text-zinc-500'}`}>
              {inputText.length} / {MAX_CHARS}
            </span>
          </div>
          <div className="relative">
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Escribe aquí tu prompt..."
              className="min-h-[120px] resize-y bg-zinc-900 border-zinc-800 focus:border-blue-500 focus:ring-blue-500/20 text-zinc-100 placeholder:text-zinc-600 rounded-xl font-mono text-sm p-4 pb-14"
            />
            <div className="absolute bottom-3 right-3">
              <Button 
                onClick={handleSubmit} 
                disabled={!inputText.trim() || inputText.length > MAX_CHARS || isSubmitting}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-all"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Enviar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
