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
  ExternalLink,
  Loader2,
  Send,
  ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const TEAMS = ["TOM", "ANA", "DIANA"];

interface Prompt {
  id: string;
  team: string;
  text: string;
  created_at: string;
  marked?: boolean;
  from_admin?: boolean;
}

interface TeamLink {
  team: string;
  url: string;
}

export default function Home() {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [teamLink, setTeamLink] = useState<string>("");
  const endOfListRef = useRef<HTMLDivElement | null>(null);

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, ease: "easeOut" as const },
  };

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

    const fetchTeamLink = async () => {
      const { data } = await supabase
        .from("team_links")
        .select("team,url")
        .eq("team", selectedTeam)
        .maybeSingle();

      const linkData = data as TeamLink | null;
      setTeamLink(linkData?.url ?? "");
    };

    fetchTeamLink();

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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "team_links",
          filter: `team=eq.${selectedTeam}`,
        },
        (payload) => {
          setTeamLink((payload.new as TeamLink).url ?? "");
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_links",
          filter: `team=eq.${selectedTeam}`,
        },
        (payload) => {
          setTeamLink((payload.new as TeamLink).url ?? "");
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
      toast.success("Prompt copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("No se pudo copiar el prompt");
    }
  };

  const handleSubmit = async () => {
    if (!inputText.trim() || !selectedTeam) return;

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
      toast.error("Error sending prompt");
      return;
    }

    if (data) {
      setPrompts((prev) => [...prev, data as Prompt]);
    }

    toast.success("Prompt sent successfully");
    setInputText("");
  };

  if (!selectedTeam) {
    return (
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="app-canvas h-dvh overflow-hidden px-4 py-4 text-slate-100 md:px-10 md:py-8"
      >
        <section className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4 md:gap-8">
          <motion.header {...fadeInUp} className="soft-panel rounded-3xl px-5 py-5 md:px-10 md:py-8">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-400/20 bg-slate-900/30 px-3 py-1 text-xs font-medium text-slate-200 md:text-sm">
              <span
                className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`}
              />
              {isConnected ? "Connected" : "Checking connection"}
            </div>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
              className="text-balance text-3xl font-semibold tracking-tight text-white md:text-5xl"
            >
              <motion.span
                animate={{
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                }}
                transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
                className="inline-block bg-[linear-gradient(110deg,#f8fafc_20%,#7dd3fc_45%,#f8fafc_70%)] bg-[length:220%_100%] bg-clip-text text-transparent"
              >
                Agentic Engineering Prompt Hub
              </motion.span>
            </motion.h1>
            <p className="mt-3 max-w-3xl text-pretty text-sm text-slate-300 md:mt-4 md:text-lg">
              A shared workspace for each team to submit prompts in real time, with insertion tracking from the instructor panel.
            </p>
          </motion.header>

          <section className="grid min-h-0 grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
            {TEAMS.map((team, index) => (
              <motion.button
                key={team}
                type="button"
                onClick={() => setSelectedTeam(team)}
                className={`soft-panel animate-rise group relative flex min-h-[170px] flex-col justify-between overflow-hidden rounded-2xl border p-4 text-left transition duration-300 hover:-translate-y-0.5 hover:border-sky-300/60 hover:shadow-[0_24px_50px_-28px_rgba(30,64,175,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 md:min-h-[210px] md:p-6 ${
                  index === 2 ? "col-span-2 md:col-span-1" : ""
                }`}
                style={{ animationDelay: `${index * 60}ms` }}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.08 + index * 0.08, ease: "easeOut" }}
                whileHover={{ y: -4, scale: 1.01 }}
                whileTap={{ scale: 0.995 }}
              >
                <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/60 to-transparent" />
                <div className="mb-3 md:mb-5" />
                <div>
                  <h2 className="text-3xl font-semibold text-white md:text-4xl">{team}</h2>
                  <p className="mt-2 max-w-[24ch] text-xs text-slate-300 md:text-sm">
                    Send prompts and track processing status in real time.
                  </p>
                </div>
                <div className="mt-4 inline-flex w-fit items-center rounded-md border border-sky-400/30 bg-sky-950/25 px-2.5 py-1 text-xs font-medium text-sky-200 transition group-hover:border-sky-300/70 group-hover:text-sky-100">
                  Enter channel
                </div>
              </motion.button>
            ))}
          </section>
        </section>
      </motion.main>
    );
  }

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="app-canvas flex h-dvh overflow-hidden flex-col px-4 pb-4 pt-4 text-slate-100 md:px-8 md:pb-6 md:pt-6"
    >
      <motion.header {...fadeInUp} className="soft-panel mx-auto mb-4 flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 md:px-6">
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
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Active channel</p>
            <h2 className="text-xl font-semibold text-white md:text-2xl">Team {selectedTeam}</h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {teamLink ? (
            <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
              <span className="max-w-[min(80vw,520px)] break-all rounded-full border border-slate-400/25 bg-slate-900/45 px-3 py-1 text-xs font-medium text-slate-200">
                {teamLink}
              </span>
              <a
                href={teamLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/35 bg-sky-900/25 px-3 py-1 text-xs font-medium text-sky-200 hover:bg-sky-800/35"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open link
              </a>
            </div>
          ) : null}
          <div className="flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-900/20 px-3 py-1 text-xs font-medium text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            {insertedCount} inserted
          </div>
        </div>
      </motion.header>

      <section className="mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-300/15 bg-slate-950/35">
        <ScrollArea className="min-h-0 flex-1 px-4 py-4 md:px-7 md:py-6">
          {prompts.length === 0 ? (
            <div className="flex h-[52vh] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-500/35 bg-slate-900/20 text-slate-400">
              <BotMessageSquare className="mb-3 h-11 w-11 opacity-45" />
              <p className="text-sm md:text-base">There are no prompts in this team yet.</p>
            </div>
          ) : (
            <div className="space-y-4 pb-2">
              {prompts.map((prompt) => (
                <motion.article
                  key={prompt.id}
                  className={`animate-rise rounded-2xl border px-4 py-4 shadow-sm md:px-5 ${
                    prompt.marked
                      ? "border-emerald-400/45 bg-emerald-950/20"
                      : "border-slate-500/30 bg-slate-900/35"
                  }`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  <p className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-slate-200 md:text-[0.92rem]">
                    {prompt.text}
                  </p>
                  <footer className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      {prompt.from_admin ? (
                        <span className="inline-flex items-center rounded-full border border-sky-400/45 bg-sky-950/35 px-2 py-0.5 text-[11px] font-semibold text-sky-300">
                          Admin
                        </span>
                      ) : null}
                      <span>
                        {new Date(prompt.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {prompt.marked ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/45 bg-emerald-950/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Inserted
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
                      {copiedId === prompt.id ? "Copied" : "Copy"}
                    </Button>
                  </footer>
                </motion.article>
              ))}
              <div ref={endOfListRef} />
            </div>
          )}
        </ScrollArea>

        <div className="soft-panel border-x-0 border-b-0 rounded-none px-4 py-4 md:px-7 md:py-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <label htmlFor="prompt-input" className="text-sm font-semibold text-slate-300">
              New prompt
            </label>
            <span className="text-xs font-medium text-slate-400">
              {inputText.length} characters
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
              placeholder="Write your prompt here... (Ctrl + Enter to send)"
              className="h-[clamp(150px,28dvh,280px)] resize-none overflow-y-auto rounded-xl border-slate-500/35 bg-slate-900/50 p-4 pb-14 font-mono text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:ring-sky-400/30"
            />
            <div className="absolute bottom-3 right-3">
              <Button
                onClick={handleSubmit}
                disabled={!inputText.trim() || isSubmitting}
                className="rounded-lg bg-sky-600 text-white shadow-lg shadow-blue-950/40 transition hover:bg-sky-500"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send
              </Button>
            </div>
          </div>
        </div>
      </section>
    </motion.main>
  );
}
