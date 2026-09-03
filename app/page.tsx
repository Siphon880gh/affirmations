"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  BrainCircuit,
  Check,
  CirclePlus,
  Edit3,
  Headphones,
  Layers3,
  Play,
  RotateCcw,
  Save,
  Sparkles,
  Square,
  Volume2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type PracticeMode = "type" | "recall" | "build";

type AffirmationSet = {
  id: string;
  name: string;
  affirmations: string[];
};

type Reflection = {
  id: string;
  setId: string;
  affirmation: string;
  rating: number;
  note: string;
  bridge: string;
  createdAt: number;
};

type WordTile = {
  id: number;
  word: string;
};

const STORAGE_KEY = "affirmation-lab-state-v1";

const DEFAULT_SETS: AffirmationSet[] = [
  {
    id: "self-trust",
    name: "Steady self-trust",
    affirmations: [
      "I trust myself to meet this moment with calm and clarity.",
      "I am allowed to take up space and speak with conviction.",
      "I can learn what I need as I move forward.",
      "My actions are building a life that feels true to me.",
    ],
  },
  {
    id: "calm-body",
    name: "Calm in my body",
    affirmations: [
      "I can return to one steady breath at a time.",
      "My body is allowed to soften when I give it care.",
      "I notice tension without letting it direct me.",
      "Rest is part of how I move forward.",
    ],
  },
  {
    id: "possibility",
    name: "Open possibility",
    affirmations: [
      "I am open to outcomes better than the ones I can imagine today.",
      "Small courageous choices can change my direction.",
      "I do not need certainty to take the next honest step.",
      "There is room for a new story to become true.",
    ],
  },
];

const RATING_LABELS = [
  "Doesn’t land",
  "Mostly resistance",
  "A stretch",
  "Mostly true",
  "Deeply true",
];

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[“”‘’]/g, "'")
    .replace(/[^a-z0-9'\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function Home() {
  const [sets, setSets] = useState<AffirmationSet[]>(DEFAULT_SETS);
  const [activeSetId, setActiveSetId] = useState(DEFAULT_SETS[0].id);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<PracticeMode>("type");
  const [typedText, setTypedText] = useState("");
  const [recallText, setRecallText] = useState("");
  const [recallVisible, setRecallVisible] = useState(true);
  const [tiles, setTiles] = useState<WordTile[]>([]);
  const [selectedTileIds, setSelectedTileIds] = useState<number[]>([]);
  const [activityState, setActivityState] = useState<"idle" | "error" | "success">("idle");
  const [completedKeys, setCompletedKeys] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState("browser-default");
  const [speechRate, setSpeechRate] = useState(0.92);
  const [isPlaying, setIsPlaying] = useState(false);
  const stopPlaybackRef = useRef(false);

  const [rating, setRating] = useState<number | null>(null);
  const [beliefNote, setBeliefNote] = useState("");
  const [bridgeBelief, setBridgeBelief] = useState("");
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [insightSaved, setInsightSaved] = useState(false);
  const [bridgeSaved, setBridgeSaved] = useState(false);

  const [setDialogOpen, setSetDialogOpen] = useState(false);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [draftSetName, setDraftSetName] = useState("");
  const [draftAffirmations, setDraftAffirmations] = useState("");
  const [draftError, setDraftError] = useState("");

  const activeSet = sets.find((set) => set.id === activeSetId) ?? sets[0];
  const safeIndex = Math.min(currentIndex, Math.max(activeSet.affirmations.length - 1, 0));
  const currentAffirmation = activeSet.affirmations[safeIndex] ?? "";
  const practiceKey = `${activeSet.id}:${safeIndex}`;
  const currentTokens = useMemo(
    () => currentAffirmation.split(/\s+/).filter(Boolean),
    [currentAffirmation],
  );
  const selectedTiles = selectedTileIds
    .map((id) => currentTokens[id])
    .filter((word): word is string => Boolean(word));
  const completedInSet = completedKeys.filter((key) => key.startsWith(`${activeSet.id}:`)).length;
  const setProgress = activeSet.affirmations.length
    ? Math.round((completedInSet / activeSet.affirmations.length) * 100)
    : 0;
  const currentReflections = reflections
    .filter((entry) => entry.affirmation === currentAffirmation)
    .slice(0, 2);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as {
          sets?: AffirmationSet[];
          activeSetId?: string;
          voiceURI?: string;
          speechRate?: number;
          reflections?: Reflection[];
        };
        if (Array.isArray(parsed.sets) && parsed.sets.length > 0) {
          setSets(parsed.sets);
          if (parsed.activeSetId && parsed.sets.some((set) => set.id === parsed.activeSetId)) {
            setActiveSetId(parsed.activeSetId);
          }
        }
        if (typeof parsed.voiceURI === "string") setVoiceURI(parsed.voiceURI);
        if (typeof parsed.speechRate === "number") setSpeechRate(parsed.speechRate);
        if (Array.isArray(parsed.reflections)) setReflections(parsed.reflections);
      }
    } catch {
      // A malformed local value should never keep the practice screen from opening.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ sets, activeSetId, voiceURI, speechRate, reflections }),
    );
  }, [sets, activeSetId, voiceURI, speechRate, reflections, hydrated]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const syncVoices = () => setVoices(window.speechSynthesis.getVoices());
    syncVoices();
    window.speechSynthesis.addEventListener("voiceschanged", syncVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", syncVoices);
  }, []);

  useEffect(() => {
    const wordTiles = currentTokens.map((word, id) => ({ id, word }));
    setTiles(shuffle(wordTiles));
    setSelectedTileIds([]);
    setTypedText("");
    setRecallText("");
    setRecallVisible(true);
    setActivityState("idle");
    setRating(null);
    setBeliefNote("");
    setBridgeBelief("");
    setInsightSaved(false);
    setBridgeSaved(false);
  }, [currentAffirmation, currentTokens]);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  function markComplete() {
    setCompletedKeys((current) =>
      current.includes(practiceKey) ? current : [...current, practiceKey],
    );
    setActivityState("success");
  }

  function checkTypedAnswer() {
    if (normalize(typedText) === normalize(currentAffirmation)) {
      markComplete();
    } else {
      setActivityState("error");
    }
  }

  function checkRecallAnswer() {
    if (normalize(recallText) === normalize(currentAffirmation)) {
      markComplete();
    } else {
      setActivityState("error");
    }
  }

  function chooseTile(tile: WordTile) {
    if (selectedTileIds.includes(tile.id) || activityState === "success") return;
    const nextExpectedId = selectedTileIds.length;
    if (tile.id !== nextExpectedId) {
      setActivityState("error");
      return;
    }

    const nextSelected = [...selectedTileIds, tile.id];
    setSelectedTileIds(nextSelected);
    setActivityState("idle");
    if (nextSelected.length === currentTokens.length) markComplete();
  }

  function resetCurrentActivity() {
    setTypedText("");
    setRecallText("");
    setRecallVisible(true);
    setSelectedTileIds([]);
    setTiles(shuffle(currentTokens.map((word, id) => ({ id, word }))));
    setActivityState("idle");
  }

  function moveAffirmation(direction: -1 | 1) {
    const count = activeSet.affirmations.length;
    if (!count) return;
    setCurrentIndex((index) => (index + direction + count) % count);
  }

  function applyVoice(utterance: SpeechSynthesisUtterance) {
    const selectedVoice = voices.find((voice) => voice.voiceURI === voiceURI);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = speechRate;
    utterance.pitch = 1;
  }

  function speakCurrent() {
    if (!("speechSynthesis" in window) || !currentAffirmation) return;
    stopPlaybackRef.current = true;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentAffirmation);
    applyVoice(utterance);
    setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    window.speechSynthesis.speak(utterance);
  }

  function playSet() {
    if (!("speechSynthesis" in window) || !activeSet.affirmations.length) return;
    window.speechSynthesis.cancel();
    stopPlaybackRef.current = false;
    setIsPlaying(true);

    const speakAt = (index: number) => {
      if (stopPlaybackRef.current || index >= activeSet.affirmations.length) {
        setIsPlaying(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(activeSet.affirmations[index]);
      applyVoice(utterance);
      utterance.onend = () => speakAt(index + 1);
      utterance.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
    };

    speakAt(safeIndex);
  }

  function stopAudio() {
    stopPlaybackRef.current = true;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsPlaying(false);
  }

  function chooseSet(id: string) {
    stopAudio();
    setActiveSetId(id);
    setCurrentIndex(0);
  }

  function openCreateSet() {
    setEditingSetId(null);
    setDraftSetName("");
    setDraftAffirmations("");
    setDraftError("");
    setSetDialogOpen(true);
  }

  function openEditSet() {
    setEditingSetId(activeSet.id);
    setDraftSetName(activeSet.name);
    setDraftAffirmations(activeSet.affirmations.join("\n"));
    setDraftError("");
    setSetDialogOpen(true);
  }

  function saveSet() {
    const name = draftSetName.trim();
    const affirmations = Array.from(
      new Set(
        draftAffirmations
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );

    if (!name) {
      setDraftError("Give this set a name.");
      return;
    }
    if (!affirmations.length) {
      setDraftError("Add at least one affirmation, one per line.");
      return;
    }

    if (editingSetId) {
      setSets((current) =>
        current.map((set) =>
          set.id === editingSetId ? { ...set, name, affirmations } : set,
        ),
      );
      setCurrentIndex(0);
    } else {
      const nextSet = { id: makeId("set"), name, affirmations };
      setSets((current) => [...current, nextSet]);
      setActiveSetId(nextSet.id);
      setCurrentIndex(0);
    }
    setSetDialogOpen(false);
  }

  function saveInsight() {
    if (rating === null) return;
    const reflection: Reflection = {
      id: makeId("reflection"),
      setId: activeSet.id,
      affirmation: currentAffirmation,
      rating,
      note: beliefNote.trim(),
      bridge: bridgeBelief.trim(),
      createdAt: Date.now(),
    };
    setReflections((current) => [reflection, ...current].slice(0, 100));
    setInsightSaved(true);
  }

  function saveBridgeToSet() {
    const bridge = bridgeBelief.trim();
    if (!bridge) return;
    setSets((current) =>
      current.map((set) =>
        set.id === activeSet.id && !set.affirmations.includes(bridge)
          ? { ...set, affirmations: [...set.affirmations, bridge] }
          : set,
      ),
    );
    setBridgeSaved(true);
  }

  const activityFeedback =
    activityState === "success"
      ? "Locked in — you completed this one."
      : activityState === "error"
        ? mode === "build"
          ? "Not that tile yet. Follow the sentence from the beginning."
          : "Not quite yet. Read it once more, then try again."
        : "";

  return (
    <div className="min-h-screen text-foreground">
      <header className="border-b border-white/10 bg-[#0b0c16]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1580px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_0_28px_rgba(183,243,74,0.16)]">
              <BrainCircuit className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-[-0.02em]">Affirmation Lab</p>
              <p className="text-xs text-muted-foreground">Practice what you want to believe</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-muted-foreground sm:flex">
              <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
              Saved on this device
            </div>
            <Button
              variant="outline"
              className="h-10 rounded-full border-white/15 bg-white/[0.04] px-4 hover:bg-white/10"
              onClick={openEditSet}
            >
              <Edit3 />
              <span className="hidden sm:inline">Edit set</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1580px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:px-8 xl:grid-cols-[250px_minmax(0,1fr)_330px]">
        <aside className="rounded-[1.5rem] border border-white/10 bg-[#11131e]/90 p-3 lg:min-h-[calc(100vh-7.75rem)]">
          <div className="flex items-center justify-between px-2 py-2">
            <div>
              <p className="text-sm font-semibold">Your sets</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{sets.length} saved locally</p>
            </div>
            <Button
              size="icon-sm"
              className="rounded-full"
              onClick={openCreateSet}
              aria-label="Create a new affirmation set"
            >
              <CirclePlus />
            </Button>
          </div>

          <nav className="mt-3 grid gap-2" aria-label="Affirmation sets">
            {sets.map((set, index) => {
              const isActive = set.id === activeSet.id;
              return (
                <button
                  key={set.id}
                  type="button"
                  onClick={() => chooseSet(set.id)}
                  className={`group flex min-h-16 w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                    isActive
                      ? "border-primary/45 bg-primary text-primary-foreground shadow-[0_10px_35px_rgba(183,243,74,0.12)]"
                      : "border-transparent bg-white/[0.035] text-foreground hover:border-white/10 hover:bg-white/[0.07]"
                  }`}
                >
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-xl text-xs font-bold ${
                      isActive ? "bg-black/10" : "bg-white/[0.07] text-muted-foreground"
                    }`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{set.name}</span>
                    <span
                      className={`mt-0.5 block text-xs ${
                        isActive ? "text-primary-foreground/65" : "text-muted-foreground"
                      }`}
                    >
                      {set.affirmations.length} affirmations
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={openCreateSet}
            className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-white/15 px-4 py-3 text-sm font-medium text-muted-foreground transition hover:border-primary/60 hover:text-primary"
          >
            <CirclePlus className="size-4" />
            Create a set
          </button>

          <div className="mt-5 rounded-2xl border border-white/10 bg-[#171a27] p-4">
            <Sparkles className="size-5 text-accent" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold">Aim for believable</p>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
              Resistance is useful data. Notice it, name it, then write a smaller belief your mind can accept.
            </p>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="rounded-[1.75rem] bg-[#f7f4ea] p-4 text-[#14151d] shadow-[0_30px_80px_rgba(0,0,0,0.26)] sm:p-6 lg:p-7">
            <div className="flex flex-col gap-4 border-b border-black/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#66665f]">
                  <span className="size-2 rounded-full bg-[#6d7cff]" />
                  Now practicing
                </div>
                <h1 className="mt-2 truncate text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
                  {activeSet.name}
                </h1>
              </div>
              <div className="w-full sm:w-48">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#66665f]">
                  <span>{completedInSet} practiced</span>
                  <span>{setProgress}%</span>
                </div>
                <Progress
                  value={setProgress}
                  className="h-2 bg-black/10 [&_[data-slot=progress-indicator]]:bg-[#6d7cff]"
                  aria-label={`${setProgress}% of this set practiced`}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 py-5">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-[#55564f] hover:bg-black/[0.06] hover:text-black"
                onClick={() => moveAffirmation(-1)}
                aria-label="Previous affirmation"
              >
                <ArrowLeft />
              </Button>

              <div key={practiceKey} className="settle-in max-w-3xl px-2 text-center sm:px-6">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#76766e]">
                  {safeIndex + 1} of {activeSet.affirmations.length}
                </p>
                <blockquote className="font-serif text-[1.75rem] leading-[1.18] tracking-[-0.03em] sm:text-[2.45rem] lg:text-[3rem]">
                  “{currentAffirmation}”
                </blockquote>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-[#55564f] hover:bg-black/[0.06] hover:text-black"
                onClick={() => moveAffirmation(1)}
                aria-label="Next affirmation"
              >
                <ArrowRight />
              </Button>
            </div>

            <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="outline"
                className="rounded-full border-black/15 bg-transparent text-[#1b1c23] shadow-none hover:bg-black/[0.05]"
                onClick={speakCurrent}
              >
                <Volume2 />
                Hear this one
              </Button>
              <Button
                variant="outline"
                className="rounded-full border-black/15 bg-transparent text-[#1b1c23] shadow-none hover:bg-black/[0.05]"
                onClick={isPlaying ? stopAudio : playSet}
              >
                {isPlaying ? <Square /> : <Play />}
                {isPlaying ? "Stop" : "Play from here"}
              </Button>
              <Select value={voiceURI} onValueChange={setVoiceURI}>
                <SelectTrigger
                  className="h-9 max-w-[13rem] rounded-full border-black/15 bg-transparent text-[#1b1c23] shadow-none"
                  aria-label="Choose a browser voice"
                >
                  <AudioLines className="size-4" />
                  <SelectValue placeholder="Browser voice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="browser-default">Browser default</SelectItem>
                  {voices.map((voice, index) => (
                    <SelectItem key={`${voice.voiceURI}-${index}`} value={voice.voiceURI}>
                      {voice.name} · {voice.lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(speechRate)}
                onValueChange={(value) => setSpeechRate(Number(value))}
              >
                <SelectTrigger
                  className="h-9 w-[7rem] rounded-full border-black/15 bg-transparent text-[#1b1c23] shadow-none"
                  aria-label="Choose speech speed"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.78">Slow</SelectItem>
                  <SelectItem value="0.92">Natural</SelectItem>
                  <SelectItem value="1.08">Brisk</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Tabs
              value={mode}
              onValueChange={(value) => {
                setMode(value as PracticeMode);
                resetCurrentActivity();
              }}
              className="gap-4"
            >
              <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-[#dedbd1] p-1.5">
                <TabsTrigger
                  value="type"
                  className="min-h-11 rounded-xl text-[#65655f] data-[state=active]:!bg-[#14151d] data-[state=active]:!text-white"
                >
                  <Edit3 />
                  Type it
                </TabsTrigger>
                <TabsTrigger
                  value="recall"
                  className="min-h-11 rounded-xl text-[#65655f] data-[state=active]:!bg-[#14151d] data-[state=active]:!text-white"
                >
                  <BrainCircuit />
                  Recall
                </TabsTrigger>
                <TabsTrigger
                  value="build"
                  className="min-h-11 rounded-xl text-[#65655f] data-[state=active]:!bg-[#14151d] data-[state=active]:!text-white"
                >
                  <Layers3 />
                  Word game
                </TabsTrigger>
              </TabsList>

              <div className="min-h-[18rem] rounded-[1.35rem] border border-black/10 bg-white/55 p-4 sm:p-5">
                <TabsContent value="type" className="mt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">Type it with attention</h2>
                      <p className="mt-1 text-sm text-[#74746d]">
                        Accuracy matters less than staying present with every word.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full p-2 text-[#6e6e68] hover:bg-black/[0.06]"
                      onClick={resetCurrentActivity}
                      aria-label="Reset typed answer"
                    >
                      <RotateCcw className="size-4" />
                    </button>
                  </div>
                  <Textarea
                    value={typedText}
                    onChange={(event) => {
                      setTypedText(event.target.value);
                      if (activityState !== "idle") setActivityState("idle");
                    }}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                        checkTypedAnswer();
                      }
                    }}
                    placeholder="Type the affirmation here…"
                    className="mt-4 min-h-28 resize-none rounded-2xl border-black/15 bg-white px-4 py-3 text-base text-[#17181f] shadow-none placeholder:text-[#92928b] focus-visible:border-[#6d7cff] focus-visible:ring-[#6d7cff]/25"
                    aria-label="Type the current affirmation"
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-[#7b7b74]">Press Ctrl/⌘ + Enter to check</p>
                    <Button
                      className="rounded-full bg-[#6d7cff] px-5 text-white hover:bg-[#5d6ded]"
                      onClick={checkTypedAnswer}
                      disabled={!typedText.trim()}
                    >
                      Check my words
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="recall" className="mt-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold">Recall it from memory</h2>
                      <p className="mt-1 text-sm text-[#74746d]">
                        Read it once, hide it, then reconstruct the idea in your own attention.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="shrink-0 rounded-full border-black/15 bg-transparent text-[#1b1c23] shadow-none hover:bg-black/[0.05]"
                      onClick={() => setRecallVisible((visible) => !visible)}
                    >
                      {recallVisible ? "Hide it" : "Show it"}
                    </Button>
                  </div>
                  <div
                    className={`mt-4 min-h-20 rounded-2xl border border-black/10 px-4 py-4 font-serif text-lg leading-7 transition ${
                      recallVisible
                        ? "bg-[#ece9df] text-[#31322f]"
                        : "select-none bg-[#20212a] text-transparent"
                    }`}
                    aria-hidden={!recallVisible}
                  >
                    {recallVisible ? currentAffirmation : "The affirmation is hidden while you recall it."}
                  </div>
                  <Input
                    value={recallText}
                    onChange={(event) => {
                      setRecallText(event.target.value);
                      if (activityState !== "idle") setActivityState("idle");
                    }}
                    onFocus={() => setRecallVisible(false)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") checkRecallAnswer();
                    }}
                    placeholder="Recall the full affirmation…"
                    className="mt-3 h-12 rounded-2xl border-black/15 bg-white px-4 text-base text-[#17181f] shadow-none placeholder:text-[#92928b] focus-visible:border-[#6d7cff] focus-visible:ring-[#6d7cff]/25"
                    aria-label="Recall the current affirmation"
                  />
                  <div className="mt-3 flex justify-end">
                    <Button
                      className="rounded-full bg-[#6d7cff] px-5 text-white hover:bg-[#5d6ded]"
                      onClick={checkRecallAnswer}
                      disabled={!recallText.trim()}
                    >
                      Check recall
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="build" className="mt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">Build the sentence</h2>
                      <p className="mt-1 text-sm text-[#74746d]">
                        Tap the words in order. Start with the first word and let the pattern emerge.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full p-2 text-[#6e6e68] hover:bg-black/[0.06]"
                      onClick={resetCurrentActivity}
                      aria-label="Shuffle and reset word game"
                    >
                      <RotateCcw className="size-4" />
                    </button>
                  </div>

                  <div className="mt-4 min-h-20 rounded-2xl border border-dashed border-black/20 bg-[#ece9df] p-3">
                    {selectedTiles.length ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedTiles.map((word, index) => (
                          <span
                            key={`${word}-${index}`}
                            className="soft-pop rounded-xl bg-[#14151d] px-3 py-2 text-sm font-semibold text-white"
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="px-2 py-3 text-sm text-[#878780]">Your sentence will take shape here.</p>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2" aria-label="Shuffled word tiles">
                    {tiles.map((tile) => {
                      const used = selectedTileIds.includes(tile.id);
                      return (
                        <button
                          key={tile.id}
                          type="button"
                          disabled={used || activityState === "success"}
                          onClick={() => chooseTile(tile)}
                          className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm font-semibold text-[#24252b] shadow-sm transition hover:-translate-y-0.5 hover:border-[#6d7cff] disabled:translate-y-0 disabled:cursor-default disabled:opacity-25"
                        >
                          {tile.word}
                        </button>
                      );
                    })}
                  </div>
                </TabsContent>

                <div className="mt-4 min-h-12" aria-live="polite">
                  {activityFeedback ? (
                    <div
                      className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold ${
                        activityState === "success"
                          ? "bg-[#dff5b7] text-[#24310e]"
                          : "bg-[#ffe0d8] text-[#6a2012]"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {activityState === "success" ? (
                          <Check className="size-4" />
                        ) : (
                          <RotateCcw className="size-4" />
                        )}
                        {activityFeedback}
                      </span>
                      {activityState === "success" && (
                        <button
                          type="button"
                          onClick={() => moveAffirmation(1)}
                          className="shrink-0 underline decoration-1 underline-offset-4"
                        >
                          Next
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </Tabs>
          </div>
        </section>

        <aside className="rounded-[1.5rem] border border-white/10 bg-[#151724]/95 p-5 lg:col-start-2 xl:col-start-3 xl:row-start-1">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-accent text-accent-foreground">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold">Belief check</h2>
              <p className="text-xs text-muted-foreground">Find what pushes back</p>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-sm font-semibold">How true does this feel right now?</p>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setRating(value);
                    setInsightSaved(false);
                  }}
                  aria-label={`${value}: ${RATING_LABELS[value - 1]}`}
                  aria-pressed={rating === value}
                  className={`aspect-square rounded-xl border text-sm font-bold transition ${
                    rating === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-white/10 bg-white/[0.04] text-muted-foreground hover:border-white/25 hover:text-white"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[0.72rem] text-muted-foreground">
              <span>Resistance</span>
              <span>Feels true</span>
            </div>
          </div>

          {rating !== null && (
            <div className="settle-in mt-6 border-t border-white/10 pt-5">
              <div className="rounded-xl bg-white/[0.04] px-3 py-2 text-xs font-semibold text-primary">
                {RATING_LABELS[rating - 1]}
              </div>
              <label htmlFor="belief-note" className="mt-4 block text-sm font-semibold">
                {rating <= 3 ? "What thought argues with it?" : "What evidence supports it?"}
              </label>
              <Textarea
                id="belief-note"
                value={beliefNote}
                onChange={(event) => {
                  setBeliefNote(event.target.value);
                  setInsightSaved(false);
                }}
                placeholder={
                  rating <= 3
                    ? "Write the first honest objection that appears…"
                    : "Name one real moment, choice, or piece of evidence…"
                }
                className="mt-2 min-h-24 resize-none rounded-2xl border-white/10 bg-black/15 text-base shadow-none placeholder:text-muted-foreground/70"
              />

              {rating <= 3 && (
                <div className="mt-5">
                  <label htmlFor="bridge-belief" className="block text-sm font-semibold">
                    Make it 10% more believable
                  </label>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Write a bridge your mind does not have to fight.
                  </p>
                  <Textarea
                    id="bridge-belief"
                    value={bridgeBelief}
                    onChange={(event) => {
                      setBridgeBelief(event.target.value);
                      setBridgeSaved(false);
                    }}
                    placeholder="I am learning to trust myself one choice at a time."
                    className="mt-2 min-h-24 resize-none rounded-2xl border-white/10 bg-black/15 text-base shadow-none placeholder:text-muted-foreground/70"
                  />
                  <Button
                    variant="outline"
                    className="mt-2 w-full rounded-xl border-white/15 bg-white/[0.04] hover:bg-white/10"
                    onClick={saveBridgeToSet}
                    disabled={!bridgeBelief.trim() || bridgeSaved}
                  >
                    <CirclePlus />
                    {bridgeSaved ? "Added to this set" : "Add bridge to this set"}
                  </Button>
                </div>
              )}

              <Button
                className="mt-3 w-full rounded-xl"
                onClick={saveInsight}
                disabled={rating <= 3 && !beliefNote.trim()}
              >
                <Save />
                {insightSaved ? "Insight saved locally" : "Save this insight"}
              </Button>
            </div>
          )}

          {currentReflections.length > 0 && (
            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Earlier insight
              </p>
              <div className="mt-3 space-y-2">
                {currentReflections.map((entry) => (
                  <div key={entry.id} className="rounded-2xl bg-white/[0.04] p-3">
                    <div className="flex items-center gap-1 text-xs text-primary">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <span
                          key={index}
                          className={`size-1.5 rounded-full ${
                            index < entry.rating ? "bg-primary" : "bg-white/15"
                          }`}
                        />
                      ))}
                    </div>
                    {entry.note && (
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                        {entry.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#6d7cff]/25 bg-[#6d7cff]/10 p-4">
            <Headphones className="mt-0.5 size-4 shrink-0 text-[#8f9aff]" />
            <p className="text-xs leading-5 text-[#c1c5ec]">
              Listening can reinforce familiarity. Typing, recalling, and naming resistance keep you actively involved.
            </p>
          </div>
        </aside>
      </main>

      <Dialog open={setDialogOpen} onOpenChange={setSetDialogOpen}>
        <DialogContent className="border-white/10 bg-[#171925] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingSetId ? "Edit affirmation set" : "Create an affirmation set"}</DialogTitle>
            <DialogDescription>
              Add one affirmation per line. Your changes stay in this browser for now.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <label htmlFor="set-name" className="text-sm font-semibold">
                Set name
              </label>
              <Input
                id="set-name"
                value={draftSetName}
                onChange={(event) => {
                  setDraftSetName(event.target.value);
                  setDraftError("");
                }}
                placeholder="Confidence before hard conversations"
                className="h-11 rounded-xl"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="set-affirmations" className="text-sm font-semibold">
                Affirmations
              </label>
              <Textarea
                id="set-affirmations"
                value={draftAffirmations}
                onChange={(event) => {
                  setDraftAffirmations(event.target.value);
                  setDraftError("");
                }}
                placeholder={"I can be direct and still be kind.\nMy voice deserves room in the conversation."}
                className="min-h-48 resize-y rounded-xl"
              />
            </div>
            {draftError && (
              <p className="text-sm font-medium text-destructive" role="alert">
                {draftError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSetDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveSet}>
              <Save />
              {editingSetId ? "Save changes" : "Create set"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
