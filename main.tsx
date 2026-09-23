import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Mic,
  Square,
  ArrowRight,
  LogOut,
  BookOpen,
  BarChart3,
  UserRound,
  Upload,
  CheckCircle2,
} from "lucide-react";
import "./style.css";
import "./theme.css";
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
type Question = {
  id: string;
  question: string;
  branch: string;
  subject: string;
  topic: string;
  difficulty: string;
  interview_type: string;
  expected_concepts: string[];
};
type Catalog = {
  branches: string[];
  taxonomy: Record<string, Record<string, Record<string, string[]>>>;
  questions: number;
};
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  form = false,
) {
  const t = localStorage.getItem("token");
  const r = await fetch(API + path, {
    method,
    headers: {
      ...(t ? { Authorization: "Bearer " + t } : {}),
      ...(body && !form ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? (form ? (body as FormData) : JSON.stringify(body)) : undefined,
  });
  if (!r.ok)
    throw new Error(
      (await r.json().catch(() => ({ detail: "Request failed" }))).detail,
    );
  return r.json();
}
function demoTranscript(question: any) {
  const topic = question?.topic || "this topic";
  const subject = question?.subject || "the selected area";
  const concepts =
    question?.expected_concepts?.length > 0
      ? question.expected_concepts.slice(0, 3).join(", ")
      : "the main principles";

  return `I would start by explaining the core idea behind ${subject.toLowerCase()} and how it applies to ${topic.toLowerCase()}. The key concepts are ${concepts}. I would break the explanation into a simple flow, describe the reasoning clearly, and give a practical example to show how the approach works in real systems. I would also mention trade-offs, edge cases, and how I would validate the solution if I were implementing it.`;
}
function App() {
  const [view, setView] = useState("home"),
    [user, setUser] = useState<any>(null),
    [notice, setNotice] = useState("");
  const [auth, setAuth] = useState({ name: "", email: "", password: "" });
  const [filters, setFilters] = useState<any>({
    branch: "CSE",
    subject: "Data Structures",
    topic: "Arrays",
    difficulty: "Intermediate",
    interview_type: "Technical",
    language: "English",
    target_role: "Software Engineer",
  });
  const [interview, setInterview] = useState<any>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<any>(null);
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const recognition = useRef<any>(null);
  const finalTranscript = useRef("");
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  useEffect(() => {
    if (localStorage.token)
      request("/profile")
        .then((x) => {
          setUser(x);
          setView("dashboard");
        })
        .catch(() => localStorage.removeItem("token"));
  }, []);
  const authenticate = async (login = false) => {
    try {
      const d = await request(
        "/auth/" + (login ? "login" : "register"),
        "POST",
        login ? { email: auth.email, password: auth.password } : auth,
      );
      localStorage.token = d.token;
      setUser(d.user);
      setView("dashboard");
    } catch (e: any) {
      setNotice(e.message);
    }
  };
  const start = async () => {
    try {
      const d = await request("/interviews", "POST", filters);
      setInterview(d);
      setAnswer(demoTranscript(d.question));
      setFeedback(null);
      started.current = Date.now();
      setView("interview");
    } catch (e: any) {
      setNotice(e.message);
    }
  };
  const submit = async () => {
    if (!answer.trim()) return setNotice("Add a transcript before evaluating.");
    try {
      const d = await request(
        "/interviews/" + interview.id + "/answers",
        "POST",
        {
          question_id: interview.question.id,
          transcript: answer,
          duration: (Date.now() - started.current) / 1000,
          pauses: 0,
        },
      );
      setFeedback(d.evaluation);
      setAnswer("");
      finalTranscript.current = "";
      setInterview({
        ...interview,
        question: d.next_question,
        questions_answered: d.questions_answered,
        max_questions: d.max_questions,
      });
      if (!d.next_question)
        setNotice(
          "You answered the maximum 10 questions — finish the interview.",
        );
    } catch (e: any) {
      setNotice(e.message);
    }
  };
  const record = async () => {
    if (recording) {
      recognition.current?.stop();
      recorder.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      finalTranscript.current = "";
      setAnswer("");
      const Speech =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (Speech) {
        const sr = new Speech();
        sr.continuous = true;
        sr.interimResults = true;
        sr.lang = "en-US";
        sr.onresult = (event: any) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const text = event.results[i][0].transcript;
            if (event.results[i].isFinal) finalTranscript.current += text + " ";
            else interim += text;
          }
          setAnswer((finalTranscript.current + interim).trim());
        };
        sr.start();
        recognition.current = sr;
      } else
        setNotice(
          "Live browser transcription is unavailable. Type your answer below for demo evaluation, or configure Gemini for server transcription.",
        );
      r.ondataavailable = (e) => chunks.current.push(e.data);
      r.onstop = async () => {
        recognition.current?.stop();
        stream.getTracks().forEach((x) => x.stop());
        if (finalTranscript.current.trim()) {
          setAnswer(finalTranscript.current.trim());
          setNotice("Transcript captured in demo mode. Review it, then evaluate your answer.");
          return;
        }
        const f = new FormData();
        f.append(
          "audio",
          new Blob(chunks.current, { type: r.mimeType }),
          "answer.webm",
        );
        try {
          setNotice("Finalizing transcription…");
          const d = await request("/transcribe", "POST", f, true);
          setAnswer(d.transcript);
          setNotice("Transcript ready.");
        } catch (e: any) {
          if (e.message?.includes("GEMINI_API_KEY")) {
            setNotice("Demo mode: type or paste your transcript below, then evaluate your answer.");
          } else {
            setNotice(e.message);
          }
        }
      };
      recorder.current = r;
      r.start();
      started.current = Date.now();
      setRecording(true);
    } catch (e) {
      setNotice(
        "Microphone permission was not granted. You can paste a transcript instead.",
      );
    }
  };
  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setView("home");
  };
  if (!user)
    return (
      <main className="auth">
        <div className="brand">
          <BookOpen /> THE ERUDITES
        </div>
        <section>
          <p className="eyebrow">INTERVIEW PRACTICE, WITH EVIDENCE</p>
          <h1>
            Prepare for the room
            <br />
            you want to enter.
          </h1>
          <p className="lede">
            Structured practice for technical, HR, and behavioral interviews.
            Your words and delivery are assessed separately.
          </p>
          <div className="authbox">
            <div className="switch">
              <button
                className={view === "login" ? "active" : ""}
                onClick={() => setView("login")}
              >
                Sign in
              </button>
              <button
                className={view === "register" ? "active" : ""}
                onClick={() => setView("register")}
              >
                Create account
              </button>
            </div>
            {view === "register" && (
              <label>
                Name
                <input
                  value={auth.name}
                  onChange={(e) => setAuth({ ...auth, name: e.target.value })}
                />
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                value={auth.email}
                onChange={(e) => setAuth({ ...auth, email: e.target.value })}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={auth.password}
                onChange={(e) => setAuth({ ...auth, password: e.target.value })}
              />
            </label>
            <button
              className="primary full"
              onClick={() => authenticate(view === "login")}
            >
              {view === "login" ? "Sign in" : "Create account"}{" "}
              <ArrowRight size={17} />
            </button>
          </div>
        </section>
        {notice && <p className="notice">{notice}</p>}
      </main>
    );
  const workspaceView = view === "interview" || view === "report" ? "practice" : view;
  const workspaceNav = [
    ["dashboard", "Overview", BarChart3],
    ["practice", "Practice", Mic],
    ["bank", "Question bank", BookOpen],
    ["profile", "Profile", UserRound],
  ] as const;
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <BookOpen /> THE ERUDITES
        </div>
        <div className="navs" aria-label="Workspace navigation">
          {workspaceNav.map(([key, label, Icon]) => (
            <button
              className={workspaceView === key ? "nav active" : "nav"}
              onClick={() => setView(key)}
              key={key}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="sidebarfoot">
          <span>{user.name}</span>
          <button onClick={logout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <main className="content">
        {notice && (
          <div className="notice">
            {notice}
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}
        {view === "dashboard" && (
          <Dashboard start={() => setView("practice")} user={user} />
        )}{" "}
        {view === "practice" && (
          <Practice filters={filters} setFilters={setFilters} start={start} />
        )}{" "}
        {view === "bank" && <Bank />}
        {view === "profile" && (
          <Profile user={user} setUser={setUser} notify={setNotice} />
        )}{" "}
        {view === "interview" && (
          <Interview
            q={interview.question}
            answer={answer}
            setAnswer={setAnswer}
            recording={recording}
            record={record}
            submit={submit}
            feedback={feedback}
            finish={async () => {
              const r = await request(
                "/interviews/" + interview.id + "/complete",
                "POST",
              );
              setInterview({ ...interview, report: r });
              setView("report");
            }}
          />
        )}
        {view === "report" && (
          <Report report={interview.report} back={() => setView("dashboard")} />
        )}
      </main>
    </div>
  );
}
function Dashboard({ start, user }: { start: () => void; user: any }) {
  const [d, setD] = useState<any>();
  useEffect(() => {
    request("/dashboard").then(setD);
  }, []);
  const a = d?.analytics;
  const rubric = a?.rubric_scores || {};
  const formatDuration = (seconds: number | undefined) => {
    if (!seconds || seconds < 0 || seconds > 3600) return "—";
    const total = Math.round(seconds);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };
  return (
    <>
      <header className="dashboardhead">
        <div>
          <p className="eyebrow">YOUR PRACTICE SPACE</p>
          <h1>Hello, {user?.name || "there"}.</h1>
          <p>
            See the signals behind your practice and choose the next skill to
            sharpen.
          </p>
        </div>
        <button className="primary" onClick={start}>
          Start practice <ArrowRight size={17} />
        </button>
      </header>
      <section className="overviewgrid">
        <div className="scorecard">
          <div>
            <p className="eyebrow">READINESS SNAPSHOT</p>
            <h2>
              {a?.average_score ?? "—"}
              <small>/100</small>
            </h2>
            <p>
              {a?.answered_questions
                ? `${a.answered_questions} answers reviewed across ${d.interviews.length} interview${d.interviews.length === 1 ? "" : "s"}.`
                : "Complete your first interview to establish a baseline."}
            </p>
          </div>
          <div className="scoremark">
            <CheckCircle2 size={25} />
          </div>
        </div>
        <div className="metrics">
          <Metric
            label="Completed interviews"
            value={d?.interviews.length ?? "—"}
          />
          <Metric
            label="Average answer time"
            value={
              a?.average_duration_seconds
                ? formatDuration(a.average_duration_seconds)
                : "—"
            }
          />
          <Metric
            label="Speaking pace"
            value={
              a?.average_speaking_rate_wpm
                ? Math.round(a.average_speaking_rate_wpm)
                : "—"
            }
            suffix={a?.average_speaking_rate_wpm ? " wpm" : ""}
          />
          <Metric
            label="Filler words / answer"
            value={a?.average_filler_words ?? "—"}
          />
          <Metric
            label="Answer quality"
            value={a?.answer_average_score ?? "—"}
            suffix={a?.answer_average_score ? " / 100" : ""}
          />
          <Metric
            label="Question completion"
            value={a?.completion_rate ?? "—"}
            suffix={a?.completion_rate ? "%" : ""}
          />
        </div>
      </section>
      <div className="dashboardcolumns">
        <section className="panel chartpanel">
          <div className="paneltitle">
            <div>
              <p className="eyebrow">CONSISTENCY</p>
              <h2>Progress over time</h2>
            </div>
            <span className="panelnote">Content score</span>
          </div>
          {d?.trend?.length ? (
            <div className="chart">
              {d.trend.map((x: any) => (
                <div
                  className="bar"
                  style={{ height: Math.max(x.score, 8) + "%" }}
                  title={`${x.date}: ${x.score}`}
                  key={x.date}
                >
                  <span>{x.score}</span>
                  <small>{x.date}</small>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="Complete a practice interview to see evidence-based progress here." />
          )}
        </section>
        <section className="panel focuspanel">
          <div className="paneltitle">
            <div>
              <p className="eyebrow">CAPABILITY PROFILE</p>
              <h2>Where you stand</h2>
            </div>
          </div>
          {Object.entries(rubric).map(([key, value]: any) => (
            <div className="rubric" key={key}>
              <div>
                <span>{key.replace("_", " ")}</span>
                <b>{value}</b>
              </div>
              <div className="track">
                <i style={{ width: `${value}%` }} />
              </div>
            </div>
          ))}
          {!Object.keys(rubric).length && (
            <Empty text="Your capability profile will appear after your first reviewed answer." />
          )}
        </section>
      </div>
      <section className="dashboardcolumns lower">
        <section className="panel deliverypanel">
          <div className="paneltitle">
            <div>
              <p className="eyebrow">DELIVERY SIGNALS</p>
              <h2>How you sound</h2>
            </div>
          </div>
          <div className="deliverystats">
            <div>
              <strong>
                {a?.average_duration_seconds
                  ? formatDuration(a.average_duration_seconds)
                  : "—"}
              </strong>
              <span>average response</span>
            </div>
            <div>
              <strong>
                {a?.average_speaking_rate_wpm
                  ? Math.round(a.average_speaking_rate_wpm) + " wpm"
                  : "—"}
              </strong>
              <span>speaking pace</span>
            </div>
            <div>
              <strong>{a?.average_filler_words ?? "—"}</strong>
              <span>filler words</span>
            </div>
          </div>
          <p className="muted">
            Use these signals to make your answers easier to follow. They are
            not judgments about accent or identity.
          </p>
          <p className="muted">
            {a?.strongest_area
              ? `Strongest area: ${a.strongest_area.name} (${a.strongest_area.score}/100).`
              : "Your strongest capability will appear after reviewed answers."}
          </p>
        </section>
        <section className="panel recommendation">
          <p className="eyebrow">NEXT FOCUS</p>
          <h2>
            {a?.weakest_area
              ? `Strengthen ${a.weakest_area.name.toLowerCase()}.`
              : "Build your first evidence set."}
          </h2>
          <p>
            {a?.weakest_area
              ? `Your current average is ${a.weakest_area.score}/100 here. Choose a focused practice session and make the concept explicit in your next answer.`
              : "Complete an interview to reveal the skill areas and delivery signals that deserve your attention."}
          </p>
          <button className="secondary" onClick={start}>
            Practice this next <ArrowRight size={16} />
          </button>
        </section>
      </section>
    </>
  );
}
const Metric = ({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: React.ReactNode;
  suffix?: string;
}) => (
  <div className="metric">
    <small>{label}</small>
    <strong>
      {value}
      {suffix}
    </strong>
  </div>
);
function Practice({ filters, setFilters, start }: any) {
  const [resume, setResume] = useState("");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  useEffect(() => {
    request("/questions/filters")
      .then(setCatalog)
      .catch(() => {});
  }, []);
  const branches = catalog?.branches || [];
  const subjects = Object.keys(catalog?.taxonomy?.[filters.branch] || {});
  const topics = Object.keys(
    catalog?.taxonomy?.[filters.branch]?.[filters.subject] || {},
  );
  const difficulties =
    catalog?.taxonomy?.[filters.branch]?.[filters.subject]?.[filters.topic] ||
    [];
  const interviewType =
    filters.subject === "Human Resources"
      ? "HR"
      : filters.subject === "Behavioral Interviews" ||
          filters.subject === "Aptitude"
        ? "Behavioral"
        : "Technical";
  useEffect(() => {
    if (!catalog) return;
    const branch = branches.includes(filters.branch)
      ? filters.branch
      : branches[0];
    const nextSubjects = Object.keys(catalog.taxonomy[branch] || {});
    const subject = nextSubjects.includes(filters.subject)
      ? filters.subject
      : nextSubjects[0];
    const nextTopics = Object.keys(catalog.taxonomy[branch]?.[subject] || {});
    const topic = nextTopics.includes(filters.topic)
      ? filters.topic
      : nextTopics[0];
    const nextDifficulties = catalog.taxonomy[branch]?.[subject]?.[topic] || [];
    setFilters({
      ...filters,
      branch,
      subject,
      topic,
      difficulty: nextDifficulties.includes(filters.difficulty)
        ? filters.difficulty
        : nextDifficulties[0],
      interview_type:
        subject === "Human Resources"
          ? "HR"
          : subject === "Behavioral Interviews" || subject === "Aptitude"
            ? "Behavioral"
            : "Technical",
    });
  }, [catalog]);
  const update = (key: string, value: string) => {
    const next = { ...filters, [key]: value };
    if (key === "branch") {
      const subject = Object.keys(catalog?.taxonomy?.[value] || {})[0];
      const topic = Object.keys(catalog?.taxonomy?.[value]?.[subject] || {})[0];
      next.subject = subject;
      next.topic = topic;
      next.difficulty = catalog?.taxonomy?.[value]?.[subject]?.[topic]?.[0];
    }
    if (key === "subject") {
      const topic = Object.keys(
        catalog?.taxonomy?.[filters.branch]?.[value] || {},
      )[0];
      next.topic = topic;
      next.difficulty =
        catalog?.taxonomy?.[filters.branch]?.[value]?.[topic]?.[0];
    }
    if (key === "topic")
      next.difficulty = difficulties.includes(next.difficulty)
        ? next.difficulty
        : difficulties[0];
    next.interview_type =
      next.subject === "Human Resources"
        ? "HR"
        : next.subject === "Behavioral Interviews" ||
            next.subject === "Aptitude"
          ? "Behavioral"
          : "Technical";
    setFilters(next);
  };
  return (
    <>
      <header>
        <div>
          <p className="eyebrow">CONFIGURE SESSION</p>
          <h1>Practice interview</h1>
          <p>
            Every available branch, subject, topic, and difficulty is backed by
            seeded questions. Each interview is limited to 10 questions.
          </p>
        </div>
      </header>
      <section className="panel formgrid">
        {[
          ["branch", branches],
          ["subject", subjects],
          ["topic", topics],
          ["difficulty", difficulties],
        ].map(([key, options]: any) => (
          <label key={key}>
            {key}
            <select
              value={filters[key]}
              onChange={(e) => update(key, e.target.value)}
            >
              {options.map((x: string) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Interview type
          <input value={interviewType} readOnly />
        </label>
        <label>
          Language
          <select
            value={filters.language}
            onChange={(e) =>
              setFilters({ ...filters, language: e.target.value })
            }
          >
            <option>English</option>
            <option>English + Hindi</option>
          </select>
        </label>
        <label>
          Target role
          <input
            value={filters.target_role}
            onChange={(e) =>
              setFilters({ ...filters, target_role: e.target.value })
            }
          />
        </label>
        <label>
          Resume (PDF or DOCX)
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const f = new FormData();
              f.append("file", file);
              try {
                const r = await request("/resume", "POST", f, true);
                setResume(
                  "Skills detected: " + (r.skills.join(", ") || "none yet"),
                );
              } catch (x: any) {
                setResume(x.message);
              }
            }}
          />
        </label>
        {resume && <p>{resume}</p>}
        <button className="primary formstart" onClick={start}>
          Begin interview <ArrowRight size={17} />
        </button>
      </section>
    </>
  );
}
function Bank() {
  const [q, setQ] = useState<Question[]>([]),
    [all, setAll] = useState<Question[]>([]),
    [term, setTerm] = useState(""),
    [filters, setFilters] = useState({
      branch: "",
      subject: "",
      topic: "",
      difficulty: "",
      interview_type: "",
    });
  useEffect(() => {
    request("/questions")
      .then(setAll)
      .catch(() => {});
    load();
  }, []);
  const load = (search = term, next = filters) => {
    const params = new URLSearchParams();
    Object.entries({ ...next, q: search }).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    request("/questions?" + params.toString())
      .then(setQ)
      .catch(() => setQ([]));
  };
  const filteredOptions = (field: string) => {
    const values = all
      .filter((item) =>
        Object.entries(filters).every(
          ([key, value]) =>
            key === field || !value || item[key as keyof Question] === value,
        ),
      )
      .map((item) => item[field as keyof Question])
      .filter(Boolean);
    return [...new Set(values)].sort((a, b) =>
      String(a).localeCompare(String(b)),
    );
  };
  const update = (key: string, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    load(term, next);
  };
  const reset = () => {
    const next = {
      branch: "",
      subject: "",
      topic: "",
      difficulty: "",
      interview_type: "",
    };
    setFilters(next);
    setTerm("");
    load("", next);
  };
  const groups = q.reduce<Record<string, Question[]>>((allQuestions, item) => {
    const key = item.branch + " / " + item.subject;
    return { ...allQuestions, [key]: [...(allQuestions[key] || []), item] };
  }, {});
  return (
    <>
      <header>
        <div>
          <p className="eyebrow">CURATED PRACTICE LIBRARY</p>
          <h1>Question bank</h1>
          <p>
            Filter the seeded questions by the same areas available in Practice.
          </p>
        </div>
      </header>
      <section className="panel">
        <div className="bankfilters">
          {[
            ["branch", "Branch"],
            ["subject", "Subject"],
            ["topic", "Topic"],
            ["difficulty", "Difficulty"],
            ["interview_type", "Interview type"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <select
                value={(filters as any)[key]}
                onChange={(e) => update(key, e.target.value)}
              >
                <option value="">All</option>
                {filteredOptions(key).map((x: any) => (
                  <option key={String(x)} value={String(x)}>
                    {String(x)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button className="secondary" onClick={reset}>
            Reset filters
          </button>
        </div>
        <input
          placeholder="Search all questions, subjects, or topics"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            load(e.target.value);
          }}
        />
        <p className="resultcount">Showing {q.length} seeded questions</p>
        {Object.entries(groups).map(([group, items]) => (
          <section className="banksection" key={group}>
            <h2>
              {group} <small>{items.length}</small>
            </h2>
            <div className="questions">
              {items.map((x) => (
                <article key={x.id}>
                  <div>
                    <span>{x.topic}</span>
                    <span>{x.difficulty}</span>
                    <span>{x.interview_type}</span>
                  </div>
                  <h3>{x.question}</h3>
                  <p>
                    {x.id} · {x.subject}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </section>
    </>
  );
}
function Profile({ user, setUser, notify }: any) {
  const [p, setP] = useState(user);
  return (
    <>
      <header>
        <div>
          <p className="eyebrow">ACCOUNT</p>
          <h1>Your profile</h1>
          <p>Used to tailor your practice setup.</p>
        </div>
      </header>
      <section className="panel profile">
        {[
          ["name", "Name"],
          ["email", "Email"],
          ["college", "College"],
          ["degree", "Degree"],
          ["branch", "Branch"],
          ["graduation_year", "Graduation year"],
          ["target_role", "Target job role"],
          ["preferred_language", "Preferred language"],
        ].map(([k, l]) => (
          <label>
            {l}
            <input
              value={p[k] || ""}
              onChange={(e) => setP({ ...p, [k]: e.target.value })}
            />
          </label>
        ))}
        <button
          className="primary"
          onClick={async () => {
            const x = await request("/profile", "PUT", p);
            setUser(x);
            notify("Profile saved.");
          }}
        >
          Save changes
        </button>
      </section>
    </>
  );
}
function Interview({
  q,
  answer,
  setAnswer,
  recording,
  record,
  submit,
  feedback,
  finish,
}: any) {
  return (
    <>
      <div className="interviewtop">
        <span>LIVE PRACTICE</span>
        <span>Question {feedback ? "review" : ""}</span>
      </div>
      {q ? (
        <>
          <section className="question">
            <p className="eyebrow">
              {q.branch} · {q.subject} · {q.difficulty}
            </p>
            <h1>{q.question}</h1>
            <p>
              Take a moment. Address the key concepts in a clear, logical order.
            </p>
          </section>
          <section className="answerbox">
            <div className="record">
              <button
                className={recording ? "recording" : "mic"}
                onClick={record}
              >
                {recording ? <Square size={24} /> : <Mic size={24} />}
              </button>
              <div>
                <b>
                  {recording
                    ? "Recording your response"
                    : "Record your response"}
                </b>
                <p>
                  {recording
                    ? "Select stop when you are done."
                    : "Your transcript will appear below. Or type/paste it directly."}
                </p>
              </div>
            </div>
            <textarea
              placeholder="Transcript appears here, or type your response…"
              value={answer}
              readOnly
              onFocus={(e) => e.target.blur()}
              onChange={(e) => setAnswer(e.target.value)}
            />
            <div className="actionrow">
              <button className="secondary" onClick={finish}>
                Finish interview
              </button>
              <button className="primary" onClick={submit}>
                Evaluate answer <ArrowRight size={17} />
              </button>
            </div>
          </section>
        </>
      ) : (
        <section className="panel">
          <h2>Maximum reached</h2>
          <p>
            This interview is limited to 10 questions. Finish the interview to
            see your report.
          </p>
          <button className="primary" onClick={finish}>
            View report
          </button>
        </section>
      )}
      {feedback && (
        <section className="panel feedback">
          <p className="eyebrow">ANSWER REVIEW · {feedback.mode}</p>
          <h2>Content: {feedback.content.correctness}/100</h2>
          <div className="split">
            <p>
              <b>Missing concepts</b>
              <br />
              {feedback.content.missing_concepts.join(", ") ||
                "No gaps detected by the selected rubric."}
            </p>
            <p>
              <b>Delivery</b>
              <br />
              {feedback.delivery.response_words} words ·{" "}
              {feedback.delivery.speaking_rate_wpm} wpm ·{" "}
              {feedback.delivery.filler_words} filler words
            </p>
          </div>
          <p>{feedback.feedback.recommendations[0]}</p>
        </section>
      )}
    </>
  );
}
function Report({ report, back }: any) {
  return (
    <>
      <header>
        <div>
          <p className="eyebrow">INTERVIEW REPORT</p>
          <h1>{report.overall_score}/100</h1>
          <p>
            {report.summary.branch} · {report.summary.interview_type} ·{" "}
            {report.summary.question_count} questions
          </p>
        </div>
        <button className="primary" onClick={back}>
          Return to dashboard
        </button>
      </header>
      <section className="panel">
        <h2>Answer-by-answer feedback</h2>
        {report.answers.length ? (
          report.answers.map((a: any, i: number) => (
            <article className="reportanswer">
              <small>QUESTION {i + 1}</small>
              <h3>{a.question.question}</h3>
              <p>{a.transcript}</p>
              <b>Content score: {a.evaluation.content.correctness}/100</b>
              <p>
                Missing concepts:{" "}
                {a.evaluation.content.missing_concepts.join(", ") ||
                  "None identified"}
              </p>
            </article>
          ))
        ) : (
          <Empty text="No answers were evaluated in this session." />
        )}
      </section>
    </>
  );
}
const Empty = ({ text }: { text: string }) => <p className="empty">{text}</p>;
createRoot(document.getElementById("root")!).render(<App />);
