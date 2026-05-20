import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addComment,
  changePassword,
  login,
  getCurrentUser,
  AppUser,
  createUser,
  deleteComment,
  editComment,
  getImports,
  getMetadata,
  getTicket,
  getMentionUsers,
  getUsers,
  importCsv,
  ImportBatch,
  ImportResult,
  Metadata,
  searchTickets,
  TicketDetail,
  TicketListItem,
  updateUserRole
} from './api';
import {
  ArrowUpRight,
  Check,
  Copy,
  Database,
  FileUp,
  MessageSquare,
  Moon,
  Pencil,
  RefreshCcw,
  Save,
  Search,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserPlus,
  X
} from 'lucide-react';
import './styles.css';

type View = 'dashboard' | 'search' | 'admin';
type Theme = 'databank-light' | 'databank-dark' | 'enterprise-light' | 'midnight-dark';

type NewUserForm = {
  displayName: string;
  email: string;
  username: string;
  role: 'ADMIN' | 'END USER';
};

type FilterPreset = 'all' | 'inProcess' | 'withComments';

const PAGE_SIZE = 25;

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

function shortText(value?: string | null, limit = 170) {
  if (!value) return 'No summary available.';
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).trim()}…`;
}

function statusLabel(ticket?: Pick<TicketListItem, 'buildFixed'> | Pick<TicketDetail, 'buildFixed'> | null) {
  if (!ticket?.buildFixed) return 'Unknown';
  if (ticket.buildFixed.toUpperCase().includes('IN PROCESS')) return 'In Process';
  return `Fixed ${ticket.buildFixed}`;
}

function roleLabel(role?: string | null) {
  return role === 'ADMIN' ? 'ADMIN' : 'END USER';
}

function buildTicketCopyText(ticket: TicketDetail) {
  const lines = [
    `Ticket: ${ticket.ticketKey}`,
    `Issue Title: ${ticket.issueTitle ?? '—'}`,
    `Platform: ${ticket.platform ?? '—'}`,
    `Functionality: ${ticket.functionality ?? '—'}`,
    `Version Found: ${ticket.versionFound ?? '—'}`,
    `Build Fixed: ${ticket.buildFixed ?? '—'}`,
    `Last Imported: ${formatDate(ticket.lastImportedAt)}`,
    `Last Updated: ${formatDate(ticket.updatedAt)}`,
    '',
    'Summary:',
    ticket.summary ?? '—'
  ];

  if (ticket.sourceInternalComments) {
    lines.push('', 'Imported Internal Comments:', ticket.sourceInternalComments);
  }

  return lines.join('\n');
}

function normalizeRole(role?: string | null) {
  return roleLabel(role);
}

function listSummary(values: string[], emptyLabel: string) {
  if (values.length === 0) return emptyLabel;
  if (values.length === 1) return values[0];
  return `${values.length} selected`;
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter(x => x !== value) : [...values, value];
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') ?? '');
  const [loggedInUser, setLoggedInUser] = useState<AppUser | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [view, setView] = useState<View>('search');
  const [theme, setTheme] = useState<Theme>('databank-dark');
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [search, setSearch] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [functionalities, setFunctionalities] = useState<string[]>([]);
  const [buildFixedValues, setBuildFixedValues] = useState<string[]>([]);
  const [versionFoundValues, setVersionFoundValues] = useState<string[]>([]);
  const [hasComments, setHasComments] = useState('');
  const [inProcessOnly, setInProcessOnly] = useState(false);
  const [sort, setSort] = useState('relevance');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentAuthorContact, setCommentAuthorContact] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [newUser, setNewUser] = useState<NewUserForm>({ displayName: '', email: '', username: '', role: 'END USER' });

  const isAdminRoute = window.location.pathname.toLowerCase().startsWith('/admin');
  const currentUser = loggedInUser;
  const isAdmin = loggedInUser?.role === 'ADMIN';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (isAdminRoute) setView('admin');
  }, [isAdminRoute]);

  useEffect(() => {
    if (!token) return;
    getCurrentUser()
      .then(setLoggedInUser)
      .catch((ex) => {
        localStorage.removeItem('token');
        setToken('');
        setAuthError(ex instanceof Error ? ex.message : 'Session expired. Please log in again.');
      });
  }, [token]);


  const refreshMetadata = useCallback(async () => {
    try {
      const [meta, mentionUsers] = await Promise.all([getMetadata(), getMentionUsers()]);
      setMetadata(meta);
      setUsers(mentionUsers);

      if (isAdminRoute && token) {
        const [adminUsers, importList] = await Promise.all([getUsers(), getImports()]);
        setUsers(adminUsers);
        setImports(importList);
      } else {
        setImports([]);
      }
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Unable to load metadata.');
    }
  }, [isAdminRoute, token]);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await searchTickets({
        search,
        platforms,
        functionalities,
        buildFixedValues,
        versionFoundValues,
        hasComments: hasComments === '' ? undefined : hasComments === 'true',
        inProcess: inProcessOnly ? true : undefined,
        sort,
        page,
        pageSize: PAGE_SIZE
      });
      setTickets(result.items);
      setTotalPages(Math.max(1, result.totalPages));
      setTotalCount(result.totalCount);
      setSelectedKey(previous => {
        if (previous && result.items.some(item => item.ticketKey === previous)) return previous;
        return result.items[0]?.ticketKey ?? null;
      });
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Search failed.');
    } finally {
      setLoading(false);
    }
  }, [buildFixedValues, functionalities, hasComments, inProcessOnly, page, platforms, search, sort, versionFoundValues]);

  useEffect(() => {
    refreshMetadata();
  }, [refreshMetadata]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (!selectedKey) {
      setSelectedTicket(null);
      return;
    }

    getTicket(selectedKey)
      .then(setSelectedTicket)
      .catch((ex) => setError(ex instanceof Error ? ex.message : 'Could not load ticket detail.'));
  }, [selectedKey]);

  const dashboardStats = useMemo(() => {
    const total = metadata?.totalTickets ?? 0;
    const comments = metadata?.ticketsWithComments ?? 0;
    const inProcess = metadata?.inProcessTickets ?? 0;
    return [
      { label: 'Total JIRAs/SCRs', value: total.toLocaleString(), icon: Database, preset: 'all' as FilterPreset },
      { label: 'In Process', value: inProcess.toLocaleString(), icon: RefreshCcw, preset: 'inProcess' as FilterPreset },
      { label: 'With Comments', value: comments.toLocaleString(), icon: MessageSquare, preset: 'withComments' as FilterPreset },
      { label: 'Platforms', value: (metadata?.platforms.length ?? 0).toLocaleString(), icon: Sparkles, preset: 'all' as FilterPreset }
    ];
  }, [metadata]);

  function clearFieldFilters() {
    setSearch('');
    setPlatforms([]);
    setFunctionalities([]);
    setBuildFixedValues([]);
    setVersionFoundValues([]);
    setHasComments('');
    setInProcessOnly(false);
    setSort('relevance');
    setPage(1);
  }

  function openPreset(preset: FilterPreset) {
    clearFieldFilters();
    setView('search');
    setPage(1);

    if (preset === 'inProcess') {
      setInProcessOnly(true);
      setSort('updatedDesc');
    }

    if (preset === 'withComments') {
      setHasComments('true');
      setSort('updatedDesc');
    }
  }

  async function refreshSelectedTicket() {
    if (!selectedTicket) return;
    const refreshed = await getTicket(selectedTicket.ticketKey);
    setSelectedTicket(refreshed);
  }

  async function handleImport(file?: File) {
    if (!file) return;
    setLoading(true);
    setError(null);
    setImportResult(null);
    try {
      const uploadedBy = currentUser?.username ?? 'local-admin';
      const result = await importCsv(file, uploadedBy);
      setImportResult(result);
      setPage(1);
      await refreshMetadata();
      await loadTickets();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Import failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddComment() {
    if (!selectedTicket || !commentText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await addComment(
        selectedTicket.ticketKey,
        commentText,
        commentAuthorContact.trim() || null,
        false
      );
      setCommentText('');
      setCommentAuthorContact('');
      await refreshSelectedTicket();
      await refreshMetadata();
      await loadTickets();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Could not add comment.');
    } finally {
      setLoading(false);
    }
  }

  async function handleEditComment(commentId: number, newText: string) {
    if (!newText.trim()) return;
    if (!isAdmin) {
      setError('Only admins can edit comments.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await editComment(commentId, newText);
      await refreshSelectedTicket();
      await refreshMetadata();
      await loadTickets();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Could not edit comment.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteComment(commentId: number) {
    if (!isAdmin) {
      setError('Only admins can delete comments.');
      return;
    }

    const confirmed = window.confirm('Delete this comment? It will be hidden from the app but retained in the database as deleted.');
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    try {
      await deleteComment(commentId);
      await refreshSelectedTicket();
      await refreshMetadata();
      await loadTickets();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Could not delete comment.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser() {
    if (!newUser.displayName.trim() || !newUser.username.trim()) return;
    setError(null);
    try {
      await createUser(newUser);
      setNewUser({ displayName: '', email: '', username: '', role: 'END USER' });
      setUsers(await getUsers());
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Could not create user.');
    }
  }

  async function handleUpdateUserRole(userId: number, role: string) {
    setError(null);
    try {
      await updateUserRole(userId, role);
      setUsers(await getUsers());
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Could not update user role.');
    }
  }

  async function handleLogin() {
    if (!username.trim() || !password) return;
    setAuthError(null);
    try {
      const response = await login(username, password);
      localStorage.setItem('token', response.token);
      setToken(response.token);
      setLoggedInUser(response.user);
      setMustChangePassword(response.mustChangePassword);
      setPassword('');
    } catch (ex) {
      setAuthError(ex instanceof Error ? ex.message : 'Login failed. Please check your username and password.');
    }
  }

  async function handlePasswordChange() {
    if (!password || !newPassword.trim()) return;
    setAuthError(null);
    try {
      await changePassword(password, newPassword);
      localStorage.removeItem('token');
      setToken('');
      setLoggedInUser(null);
      setMustChangePassword(false);
      setPassword('');
      setNewPassword('');
      setAuthError('Password changed successfully. Please log in again.');
    } catch (ex) {
      setAuthError(ex instanceof Error ? ex.message : 'Could not change password.');
    }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    setToken('');
    setLoggedInUser(null);
    setUsers([]);
    setTickets([]);
    setSelectedTicket(null);
    setSelectedKey(null);
  }

  if (isAdminRoute && !token) {
    return (
      <form
        className="login-container"
        onSubmit={(e) => {
          e.preventDefault();
          void handleLogin();
        }}
      >
        <div className="brand-card">
          <div className="brand-mark">JH</div>
          <div>
            <h1>JIRA Hub</h1>
            <p>Searchable SCR/JIRA knowledge base</p>
          </div>
        </div>
        <p className="eyebrow">Sign in</p>
        <input
          name="username"
          autoComplete="username"
          autoFocus
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={!username.trim() || !password}>Login</button>
        {authError && <p className={authError.includes('successfully') ? 'hint' : 'error'}>{authError}</p>}
      </form>
    );
  }

  if (isAdminRoute && mustChangePassword) {
    return (
      <form
        className="login-container"
        onSubmit={(e) => {
          e.preventDefault();
          void handlePasswordChange();
        }}
      >
        <div className="brand-card">
          <div className="brand-mark">JH</div>
          <div>
            <h1>JIRA Hub</h1>
            <p>First login password reset</p>
          </div>
        </div>
        <p className="password-rules">Set a new password before using the deployed app. Use a strong password because this account controls admin functions.</p>
        <input
          name="current-password"
          type="password"
          autoComplete="current-password"
          autoFocus
          placeholder="Current password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          name="new-password"
          type="password"
          autoComplete="new-password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <button type="submit" disabled={!password || !newPassword.trim()}>Change Password</button>
        {authError && <p className="error">{authError}</p>}
      </form>
    );
  }

  if (isAdminRoute && token && !loggedInUser) {
    return (
      <div className="login-container">
        <div className="brand-card">
          <div className="brand-mark">JH</div>
          <div>
            <h1>JIRA Hub</h1>
            <p>Loading admin session</p>
          </div>
        </div>
        <p className="hint">Checking admin session...</p>
      </div>
    );
  }

  if (isAdminRoute && token && loggedInUser && !isAdmin) {
    return (
      <div className="login-container">
        <div className="brand-card">
          <div className="brand-mark">JH</div>
          <div>
            <h1>JIRA Hub</h1>
            <p>Admin access required</p>
          </div>
        </div>
        <p className="error">This account is not an ADMIN account.</p>
        <button type="button" onClick={handleLogout}>Log out</button>
        <button type="button" className="secondary" onClick={() => { window.location.href = '/'; }}>Back to public app</button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <div className="brand-mark">JH</div>
          <div>
            <h1>JIRA Hub</h1>
            <p>Searchable SCR/JIRA knowledge base</p>
          </div>
        </div>

        <nav className="nav-list">
          {!isAdminRoute && <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>Dashboard</button>}
          {!isAdminRoute && <button className={view === 'search' ? 'active' : ''} onClick={() => setView('search')}>Search</button>}
          {isAdminRoute && isAdmin && <button className="active" onClick={() => setView('admin')}>Admin Console</button>}
          {isAdminRoute && <button onClick={() => { window.location.href = '/'; }}>Public Search</button>}
        </nav>

        <div className="user-switcher">
          <div className="section-title compact">
            <div>
              <label>{isAdminRoute ? 'Admin session' : 'Public access'}</label>
              <p className="muted-small">{isAdminRoute ? 'Admin functions require an ADMIN login.' : 'Search, dashboard, details, and comments are available without login.'}</p>
            </div>
            <Shield size={18} />
          </div>
          {isAdminRoute && currentUser ? (
            <>
              <strong>{currentUser.displayName}</strong>
              <span className="muted-small">@{currentUser.username}</span>
              <span className={isAdmin ? 'role-badge admin' : 'role-badge'}>{roleLabel(currentUser.role)}</span>
            </>
          ) : (
            <span className="muted-small">No login required for the main app.</span>
          )}
        </div>

        <div className="theme-card">
          <label>Theme</label>
          <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
            <option value="databank-light">DataBank Clean Light</option>
            <option value="databank-dark">DataBank Command Dark</option>
            <option value="enterprise-light">Soft Enterprise Light</option>
            <option value="midnight-dark">Midnight Jira</option>
          </select>
          <div className="theme-icons">
            <Sun size={18} />
            <span>Light/Dark ready</span>
            <Moon size={18} />
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Docker/PostgreSQL powered</p>
            <h2>{isAdminRoute ? 'Admin Console' : view === 'dashboard' ? 'Dashboard' : 'Search JIRAs/SCRs'}</h2>
          </div>
          <div className="topbar-actions">
            {isAdminRoute && currentUser && <span className="auth-chip">{currentUser.displayName} · {roleLabel(currentUser.role)}</span>}
            <button className="secondary" onClick={() => { refreshMetadata(); loadTickets(); }}>
              <RefreshCcw size={16} /> Refresh
            </button>
            {isAdminRoute && <button className="secondary logout-button" onClick={handleLogout}>Logout</button>}
          </div>
        </header>

        {error && <div className="error-card">{error}</div>}

        {view === 'dashboard' && (
          <section className="content-grid">
            <div className="stat-grid">
              {dashboardStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <button className="stat-card stat-button" key={stat.label} onClick={() => openPreset(stat.preset)}>
                    <div className="stat-icon"><Icon size={22} /></div>
                    <div>
                      <span>{stat.label}</span>
                      <strong>{stat.value}</strong>
                    </div>
                  </button>
                );
              })}
            </div>

            <section className="hero-card">
              <div>
                <p className="eyebrow">Testing build</p>
                <h3>Search imported SCR/JIRA records, open details, and comment.</h3>
                <p>
                  Search checks ticket fields, imported internal comments, app comments, mention usernames, and comment authors. Filters now support multiple selections.
                </p>
                <button onClick={() => setView('search')}>
                  <Search size={16} /> Open Search
                </button>
              </div>
              <div className="hero-orb" />
            </section>

            <section className="panel-card">
              <div className="section-title">
                <h3>Latest Updated Tickets</h3>
                <button className="link-button" onClick={() => openPreset('all')}>Open Search <ArrowUpRight size={14} /></button>
              </div>
              <div className="compact-list">
                {tickets.slice(0, 8).map(ticket => (
                  <button key={ticket.ticketKey} onClick={() => { setSelectedKey(ticket.ticketKey); setView('search'); }}>
                    <strong>{ticket.ticketKey}</strong>
                    <span>{ticket.functionality ?? 'Unknown'} · {statusLabel(ticket)}</span>
                  </button>
                ))}
              </div>
            </section>
          </section>
        )}

        {view === 'search' && (
          <section className="search-layout">
            <div className="search-column">
              <div className="filter-card">
                <form
                  className="search-box"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPage(1);
                    void loadTickets();
                  }}
                >
                  <Search size={18} />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setSearch('');
                        setPage(1);
                      }
                    }}
                    placeholder="Search ticket key, issue title, summary, imported comments, app comments, @mentions..."
                    aria-label="Search tickets"
                  />
                  <button type="submit" className="sr-only">Search</button>
                </form>

                <div className="filter-toolbar">
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={inProcessOnly}
                      onChange={(e) => { setInProcessOnly(e.target.checked); setPage(1); if (e.target.checked) setSort('updatedDesc'); }}
                    />
                    In process only
                  </label>
                  <select value={hasComments} onChange={(e) => { setHasComments(e.target.value); setPage(1); }}>
                    <option value="">All comments</option>
                    <option value="true">With comments</option>
                    <option value="false">No comments</option>
                  </select>
                  <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
                    <option value="relevance">Best match / newest</option>
                    <option value="updatedDesc">Latest updated first</option>
                    <option value="updatedAsc">Oldest updated first</option>
                    <option value="importedDesc">Latest imported first</option>
                    <option value="importedAsc">Oldest imported first</option>
                    <option value="buildDesc">Build highest first</option>
                    <option value="buildAsc">Build lowest first</option>
                    <option value="commentsDesc">Most comments first</option>
                    <option value="keyAsc">Ticket key A-Z</option>
                    <option value="keyDesc">Ticket key Z-A</option>
                    <option value="platformAsc">Platform A-Z</option>
                    <option value="functionalityAsc">Functionality A-Z</option>
                  </select>
                  <button className="secondary" onClick={clearFieldFilters}>Reset</button>
                </div>

                <div className="filter-row improved-filters">
                  <MultiFilter
                    label="Platforms"
                    emptyLabel="All platforms"
                    values={metadata?.platforms ?? []}
                    selected={platforms}
                    onChange={(next) => { setPlatforms(next); setPage(1); }}
                  />
                  <MultiFilter
                    label="Functionality"
                    emptyLabel="All functionality"
                    values={metadata?.functionalities ?? []}
                    selected={functionalities}
                    onChange={(next) => { setFunctionalities(next); setPage(1); }}
                  />
                  <MultiFilter
                    label="Build Fixed"
                    emptyLabel="All builds"
                    values={metadata?.buildFixedValues ?? []}
                    selected={buildFixedValues}
                    onChange={(next) => { setBuildFixedValues(next); setPage(1); }}
                  />
                  <MultiFilter
                    label="Version Found"
                    emptyLabel="All versions"
                    values={metadata?.versionFoundValues ?? []}
                    selected={versionFoundValues}
                    onChange={(next) => { setVersionFoundValues(next); setPage(1); }}
                  />
                </div>
              </div>

              <div className="active-filters">
                {inProcessOnly && <span>In process</span>}
                {hasComments === 'true' && <span>With comments</span>}
                {hasComments === 'false' && <span>No comments</span>}
                {[...platforms, ...functionalities, ...buildFixedValues, ...versionFoundValues].slice(0, 10).map(value => <span key={value}>{value}</span>)}
                {(platforms.length + functionalities.length + buildFixedValues.length + versionFoundValues.length) > 10 && <span>More filters...</span>}
              </div>

              <div className="result-toolbar">
                <span>{loading ? 'Loading...' : `${totalCount.toLocaleString()} matches · ${tickets.length} shown`}</span>
                <div>
                  <button className="secondary" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
                  <span className="page-label">{page} / {totalPages}</span>
                  <button className="secondary" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>
                </div>
              </div>

              <div className="ticket-list">
                {tickets.map(ticket => (
                  <button
                    key={ticket.ticketKey}
                    className={selectedKey === ticket.ticketKey ? 'ticket-card selected' : 'ticket-card'}
                    onClick={() => setSelectedKey(ticket.ticketKey)}
                  >
                    <div className="ticket-card-head">
                      <strong>{ticket.ticketKey}</strong>
                      <span className={ticket.buildFixed?.toUpperCase().includes('IN PROCESS') ? 'pill warning' : 'pill'}>{statusLabel(ticket)}</span>
                    </div>
                    <h4>{ticket.issueTitle ?? 'Untitled issue'}</h4>
                    <p>{shortText(ticket.summary)}</p>
                    {ticket.latestCommentPreview && (
                      <p className="comment-preview"><MessageSquare size={13} /> {shortText(ticket.latestCommentPreview, 115)}</p>
                    )}
                    <div className="ticket-meta">
                      <span>{ticket.platform ?? 'Unknown platform'}</span>
                      <span>{ticket.functionality ?? 'Unknown functionality'}</span>
                      <span>{ticket.commentCount} comments</span>
                      <span>Updated {formatDate(ticket.updatedAt)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <TicketDetailPanel
              ticket={selectedTicket}
              users={users}
              isAdmin={isAdmin}
              commentText={commentText}
              setCommentText={setCommentText}
              commentAuthorContact={commentAuthorContact}
              setCommentAuthorContact={setCommentAuthorContact}
              onAddComment={handleAddComment}
              onEditComment={handleEditComment}
              onDeleteComment={handleDeleteComment}
            />
          </section>
        )}

        {isAdminRoute && isAdmin && (
          <section className="admin-grid">
            <section className="panel-card upload-panel">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Spreadsheet import</p>
                  <h3>Upload SCR/JIRA CSV</h3>
                </div>
                <Upload size={22} />
              </div>
              <p>
                Upload the CSV export. The importer skips the SharePoint metadata row and upserts records by Title.
              </p>
              <input type="file" accept=".csv" onChange={(e) => handleImport(e.target.files?.[0])} />
              {importResult && (
                <div className="import-result">
                  <strong>Import complete</strong>
                  <div className="mini-stats">
                    <span>Total: {importResult.totalRows}</span>
                    <span>Inserted: {importResult.insertedRows}</span>
                    <span>Updated: {importResult.updatedRows}</span>
                    <span>Errors: {importResult.errorRows}</span>
                  </div>
                </div>
              )}
            </section>

            <section className="panel-card">
              <div className="section-title">
                <div>
                  <p className="eyebrow">Mentions and access</p>
                  <h3>App Users</h3>
                </div>
                <UserPlus size={22} />
              </div>
              <p className="mention-hint">New users start with Password@123 and must change it on first login.</p>
              <form
                className="user-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleCreateUser();
                }}
              >
                <input placeholder="Display name" value={newUser.displayName} onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })} />
                <input type="email" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                <input placeholder="Username, ex: brian" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
                <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as NewUserForm['role'] })}>
                  <option value="END USER">END USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                <button type="submit" disabled={!newUser.displayName.trim() || !newUser.username.trim()}>Create User</button>
              </form>
              <div className="user-list">
                {users.map(user => (
                  <div className="user-row" key={user.userId}>
                    <div>
                      <strong>{user.displayName}</strong>
                      <span>@{user.username} · {user.email ?? 'no email'}</span>
                    </div>
                    <select className="role-select" value={normalizeRole(user.role)} onChange={(e) => handleUpdateUserRole(user.userId, e.target.value)}>
                      <option value="END USER">END USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel-card full-width">
              <div className="section-title">
                <h3>Recent Imports</h3>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Uploaded</th>
                      <th>Total</th>
                      <th>Inserted</th>
                      <th>Updated</th>
                      <th>Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imports.map(item => (
                      <tr key={item.importBatchId}>
                        <td>{item.fileName}</td>
                        <td>{formatDate(item.uploadedAt)}</td>
                        <td>{item.totalRows}</td>
                        <td>{item.insertedRows}</td>
                        <td>{item.updatedRows}</td>
                        <td>{item.errorRows}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        )}
      </main>
    </div>
  );
}

interface MultiFilterProps {
  label: string;
  emptyLabel: string;
  values: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}

function MultiFilter({ label, emptyLabel, values, selected, onChange }: MultiFilterProps) {
  const [filter, setFilter] = useState('');
  const filteredValues = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const list = needle ? values.filter(value => value.toLowerCase().includes(needle)) : values;
    return list.slice(0, 120);
  }, [filter, values]);

  return (
    <details className="multi-filter">
      <summary>
        <span>{label}</span>
        <strong>{listSummary(selected, emptyLabel)}</strong>
      </summary>
      <div className="multi-filter-menu">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') setFilter(''); }}
          placeholder={`Filter ${label.toLowerCase()}...`}
        />
        <div className="multi-filter-actions">
          <button type="button" className="secondary" onClick={(e) => { e.preventDefault(); onChange([]); }}>Clear</button>
          <button type="button" className="secondary" onClick={(e) => { e.preventDefault(); onChange(values); }}>Select all</button>
        </div>
        <div className="multi-options">
          {filteredValues.map(value => (
            <label key={value}>
              <input
                type="checkbox"
                checked={selected.includes(value)}
                onChange={() => onChange(toggleValue(selected, value))}
              />
              <span>{value}</span>
            </label>
          ))}
          {filteredValues.length === 0 && <p className="empty-note">No matching values.</p>}
        </div>
      </div>
    </details>
  );
}

interface TicketDetailPanelProps {
  ticket: TicketDetail | null;
  users: AppUser[];
  isAdmin: boolean;
  commentText: string;
  setCommentText: (value: string) => void;
  commentAuthorContact: string;
  setCommentAuthorContact: (value: string) => void;
  onAddComment: () => void;
  onEditComment: (commentId: number, commentText: string) => void;
  onDeleteComment: (commentId: number) => void;
}

function TicketDetailPanel({
  ticket,
  users,
  isAdmin,
  commentText,
  setCommentText,
  commentAuthorContact,
  setCommentAuthorContact,
  onAddComment,
  onEditComment,
  onDeleteComment
}: TicketDetailPanelProps) {
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setEditingCommentId(null);
    setEditingText('');
    setCopied(false);
  }, [ticket?.ticketKey]);

  if (!ticket) {
    return (
      <aside className="detail-panel empty-detail">
        <Sparkles size={32} />
        <h3>Select a ticket</h3>
        <p>Import records, then choose a JIRA/SCR to view details and comments.</p>
      </aside>
    );
  }

  const currentTicket = ticket;

  async function copyTicketDetails() {
    const text = buildTicketCopyText(currentTicket);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function beginEdit(commentId: number, text: string) {
    setEditingCommentId(commentId);
    setEditingText(text);
  }

  function cancelEdit() {
    setEditingCommentId(null);
    setEditingText('');
  }

  function saveEdit() {
    if (!editingCommentId || !editingText.trim()) return;
    onEditComment(editingCommentId, editingText);
    cancelEdit();
  }

  return (
    <aside className="detail-panel">
      <div className="detail-header">
        <div>
          <p className="eyebrow">Ticket detail</p>
          <h3>{ticket.ticketKey}</h3>
        </div>
        <span className={ticket.buildFixed?.toUpperCase().includes('IN PROCESS') ? 'pill warning' : 'pill'}>{statusLabel(ticket)}</span>
      </div>

      <button type="button" className="copy-button" onClick={copyTicketDetails}>
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? 'Copied details' : 'Copy ticket details'}
      </button>

      <div className="detail-section">
        <h4>{ticket.issueTitle ?? 'Untitled issue'}</h4>
        <p>{ticket.summary ?? 'No summary available.'}</p>
      </div>

      <div className="field-grid">
        <div><span>Platform</span><strong>{ticket.platform ?? '—'}</strong></div>
        <div><span>Functionality</span><strong>{ticket.functionality ?? '—'}</strong></div>
        <div><span>Version Found</span><strong>{ticket.versionFound ?? '—'}</strong></div>
        <div><span>Build Fixed</span><strong>{ticket.buildFixed ?? '—'}</strong></div>
        <div><span>Last Imported</span><strong>{formatDate(ticket.lastImportedAt)}</strong></div>
        <div><span>Last Updated</span><strong>{formatDate(ticket.updatedAt)}</strong></div>
      </div>

      {ticket.sourceInternalComments && (
        <div className="source-comments">
          <span>Imported Internal Comments</span>
          <p>{ticket.sourceInternalComments}</p>
        </div>
      )}

      <div className="comments-area">
        <div className="section-title compact">
          <h3>Comments</h3>
          <span>{ticket.comments.length}</span>
        </div>

        <div className="comment-composer">
          <label className="follow-up-label">
            <span>Username / email <em>Add email for follow up on comment</em></span>
            <input
              value={commentAuthorContact}
              onChange={(e) => setCommentAuthorContact(e.target.value)}
              placeholder="Optional name or email"
            />
          </label>
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && commentText.trim()) {
                e.preventDefault();
                onAddComment();
              }
              if (e.key === 'Escape') {
                setCommentText('');
              }
            }}
            placeholder="Add comment... Use @username to mention someone. Ctrl+Enter posts. Comments are searchable."
          />
          <div className="composer-actions">
            <span className="auth-chip">Public comment</span>
            <button type="button" disabled={!commentText.trim()} onClick={onAddComment}>Post Comment</button>
          </div>
          {users.length > 0 && (
            <p className="mention-hint">Available mentions: {users.slice(0, 6).map(u => `@${u.username}`).join(', ')}</p>
          )}
          <p className="mention-hint">Only admins can delete comments.</p>
        </div>

        <div className="comment-list">
          {ticket.comments.map(comment => {
            const isEditing = editingCommentId === comment.commentId;
            const author = comment.createdByDisplayName ?? comment.commentAuthorContact ?? 'Anonymous commenter';
            return (
              <article className="comment-card" key={comment.commentId}>
                <div className="comment-head">
                  <div>
                    <strong>{author}</strong>
                    <span>{formatDate(comment.createdAt)}{comment.updatedAt ? ` · edited ${formatDate(comment.updatedAt)}` : ''}</span>
                  </div>
                  {isAdmin && !isEditing && (
                    <div className="comment-actions">
                      <button className="secondary" onClick={() => beginEdit(comment.commentId, comment.commentText)}><Pencil size={14} /> Edit</button>
                      <button className="secondary danger-button" onClick={() => onDeleteComment(comment.commentId)}><Trash2 size={14} /> Delete</button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="comment-edit-box">
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && editingText.trim()) {
                          e.preventDefault();
                          saveEdit();
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelEdit();
                        }
                      }}
                    />
                    <div className="comment-actions">
                      <button type="button" onClick={saveEdit} disabled={!editingText.trim()}><Save size={14} /> Save</button>
                      <button type="button" className="secondary" onClick={cancelEdit}><X size={14} /> Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p>{comment.commentText}</p>
                )}

                {comment.mentions.length > 0 && (
                  <div className="mentions">
                    {comment.mentions.map(mention => <span key={mention.userId}>@{mention.username}</span>)}
                  </div>
                )}
              </article>
            );
          })}
          {ticket.comments.length === 0 && <p className="empty-note">No comments yet.</p>}
        </div>
      </div>
    </aside>
  );
}
