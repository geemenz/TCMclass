"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  CheckCircle2,
  Copy,
  Inbox,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Trash2,
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

export default function AdminDashboard() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [teamLinks, setTeamLinks] = useState<Record<string, string>>({});
  const [isSavingLink, setIsSavingLink] = useState<Record<string, boolean>>({});
  const [adminDrafts, setAdminDrafts] = useState<Record<string, string>>({});
  const [isSendingAdmin, setIsSendingAdmin] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchTeamLinks = async () => {
      const { data } = await supabase.from("team_links").select("team,url");

      if (!data) return;

      const linksMap = (data as TeamLink[]).reduce<Record<string, string>>((acc, row) => {
        acc[row.team] = row.url ?? "";
        return acc;
      }, {});

      setTeamLinks(linksMap);
    };

    fetchTeamLinks();

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

  const handleLinkInputChange = (team: string, url: string) => {
    setTeamLinks((prev) => ({ ...prev, [team]: url }));
  };

  const handleSaveTeamLink = async (team: string) => {
    const rawUrl = (teamLinks[team] ?? "").trim();
    const normalizedUrl =
      rawUrl.length === 0
        ? ""
        : rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
          ? rawUrl
          : `https://${rawUrl}`;

    if (normalizedUrl) {
      try {
        new URL(normalizedUrl);
      } catch {
        toast.error("The link is not valid");
        return;
      }
    }

    setIsSavingLink((prev) => ({ ...prev, [team]: true }));

    const { error } = await supabase.from("team_links").upsert(
      {
        team,
        url: normalizedUrl,
      },
      { onConflict: "team" }
    );

    setIsSavingLink((prev) => ({ ...prev, [team]: false }));

    if (error) {
      toast.error("Could not save the link");
      return;
    }

    setTeamLinks((prev) => ({ ...prev, [team]: normalizedUrl }));
    toast.success("Enlace guardado");
  };

  const handleAdminDraftChange = (team: string, value: string) => {
    setAdminDrafts((prev) => ({ ...prev, [team]: value }));
  };

  const handleSendAdminPrompt = async (team: string) => {
    const text = (adminDrafts[team] ?? "").trim();
    if (!text) return;

    setIsSendingAdmin((prev) => ({ ...prev, [team]: true }));

    const { error } = await supabase.from("prompts").insert([
      {
        team,
        text,
        from_admin: true,
      },
    ]);

    setIsSendingAdmin((prev) => ({ ...prev, [team]: false }));

    if (error) {
      toast.error("Could not send the message to the team");
      return;
    }

    setAdminDrafts((prev) => ({ ...prev, [team]: "" }));
    toast.success(`Message sent to ${team}`);
  };

  const totalInserted = useMemo(
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
      toast.error("Error copying prompt");
    }
  };

  const handleDeletePrompt = async (id: string) => {
    const { error } = await supabase.from("prompts").delete().eq("id", id);

    if (error) {
      toast.error("Error deleting prompt");
      return;
    }

    setPrompts((prev) => prev.filter((prompt) => prompt.id !== id));
    toast.success("Prompt deleted");
  };

  const handleToggleMark = async (prompt: Prompt) => {
    const nextMarked = !prompt.marked;
    const { error } = await supabase
      .from("prompts")
      .update({ marked: nextMarked })
      .eq("id", prompt.id);

    if (error) {
      toast.error("Error updating prompt status");
      return;
    }

    setPrompts((prev) =>
      prev.map((currentPrompt) =>
        currentPrompt.id === prompt.id ? { ...currentPrompt, marked: nextMarked } : currentPrompt
      )
    );
    toast.success(nextMarked ? "Prompt marked as inserted" : "Prompt unmarked");
  };

  const getTeamPrompts = (team: string) => prompts.filter((prompt) => prompt.team === team);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="app-canvas flex min-h-screen flex-col px-4 pb-4 pt-5 text-slate-100 md:px-8 md:pb-6 md:pt-6"
    >
      <motion.header
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="soft-panel mx-auto mb-4 flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4 md:px-7"
      >
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
            <MessageSquare className="h-6 w-6 text-sky-300" />
            Admin panel
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Real-time prompt management for all three teams.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-900/20 px-3 py-1.5 text-sm font-medium text-emerald-300">
          <ShieldCheck className="h-4 w-4" />
          {totalInserted} inserted out of {prompts.length}
        </div>
      </motion.header>

      <section className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 pb-2 md:h-[calc(100vh-170px)] md:flex-1 md:flex-row md:gap-5 md:overflow-x-auto md:pb-1">
        {TEAMS.map((team, index) => {
          const teamPrompts = getTeamPrompts(team);

          return (
            <motion.article
              key={team}
              className="soft-panel animate-rise flex w-full min-w-0 flex-col rounded-2xl md:min-h-0 md:w-[390px] md:min-w-[340px]"
              style={{ animationDelay: `${index * 70}ms` }}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 + index * 0.08, ease: "easeOut" }}
            >
              <header className="flex items-center justify-between border-b border-slate-400/15 px-4 py-3 md:px-5">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className="truncate text-xl font-semibold text-white">Team {team}</h2>
                    <span className="rounded-md border border-slate-400/25 bg-slate-800/45 px-2 py-1 text-xs font-medium text-slate-300">
                      {teamPrompts.length}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={teamLinks[team] ?? ""}
                      onChange={(event) => handleLinkInputChange(team, event.target.value)}
                      placeholder="https://team-link"
                      className="h-8 w-full rounded-md border border-slate-400/25 bg-slate-900/70 px-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSaveTeamLink(team)}
                      disabled={isSavingLink[team]}
                      className="h-8 rounded-md border border-slate-400/25 bg-slate-800/60 px-2.5 text-xs text-slate-100 hover:bg-slate-700/70"
                    >
                      {isSavingLink[team] ? "..." : "Save"}
                    </Button>
                  </div>
                </div>
              </header>

              <ScrollArea className="h-[42vh] min-h-0 px-4 py-4 md:h-auto md:flex-1 md:px-5">
                {teamPrompts.length === 0 ? (
                  <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-500/35 bg-slate-900/20 text-slate-400">
                    <Inbox className="mb-2 h-8 w-8 opacity-45" />
                    <p className="text-sm">No prompts yet</p>
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
                                Inserted
                              </span>
                            ) : null}
                          </div>

                          {prompt.from_admin ? (
                            <span className="inline-flex w-fit items-center rounded-full border border-sky-400/45 bg-sky-950/40 px-2 py-0.5 text-[11px] font-semibold text-sky-300">
                              Admin
                            </span>
                          ) : null}

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
                              {prompt.marked ? "Inserted" : "Insert"}
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
                              {copiedId === prompt.id ? "Copied" : "Copy"}
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

              <div className="border-t border-slate-400/15 px-4 py-3 md:px-5">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Admin message
                </label>
                <Textarea
                  value={adminDrafts[team] ?? ""}
                  onChange={(event) => handleAdminDraftChange(team, event.target.value)}
                  placeholder="Write a message for this team..."
                  className="min-h-[88px] resize-none rounded-lg border-slate-500/35 bg-slate-900/60 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:ring-sky-400/30"
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => handleSendAdminPrompt(team)}
                    disabled={isSendingAdmin[team] || !(adminDrafts[team] ?? "").trim()}
                    className="h-8 rounded-md bg-sky-600 px-3 text-xs text-white hover:bg-sky-500"
                  >
                    {isSendingAdmin[team] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send to team"}
                  </Button>
                </div>
              </div>
            </motion.article>
          );
        })}
      </section>
    </motion.main>
  );
}
