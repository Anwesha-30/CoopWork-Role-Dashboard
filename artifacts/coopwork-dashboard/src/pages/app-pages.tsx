
import { type FormEvent, type ReactNode, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import {
  ArrowRight,
  CalendarClock,
  Check,
  CircleAlert,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  FileWarning,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Star,
  UserRound,
  UsersRound,
  Wrench,
  X,
} from 'lucide-react';

import {
  getGetAvailabilityQueryKey,
  getGetDashboardSummaryQueryKey,
  getListAdminWorkersQueryKey,
  getListBookingsQueryKey,
  getListComplaintsQueryKey,
  useCreateBooking,
  useCreateComplaint,
  useGetAvailability,
  useGetDashboardSummary,
  useGetSession,
  useListAdminWorkers,
  useListBookings,
  useListComplaints,
  useListReviews,
  useListWorkers,
  useUpdateAvailability,
  useUpdateBookingStatus,
  useUpdateWorkerVerification,
} from '@workspace/api-client-react';

import type {
  Availability,
  Booking,
  Complaint,
  Worker,
} from '@workspace/api-client-react';

import {
  AppShell,
  Avatar,
  EmptyState,
  PageError,
  PageLoading,
  StatusBadge,
} from '@/components/app-shell';


/* =========================================================
   TYPES
========================================================= */

type Role = 'customer' | 'worker' | 'cooperative_admin';

type BookingFilter =
  | 'all'
  | 'pending'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled';


/* =========================================================
   HELPERS
========================================================= */

/*
 * The backend can return bookings either as:
 *
 * [
 *   {...},
 *   {...}
 * ]
 *
 * OR:
 *
 * {
 *   bookings: [
 *     {...},
 *     {...}
 *   ]
 * }
 *
 * This helper safely converts either response into an array.
 */
function normalizeBookings(value: unknown): Booking[] {
  if (Array.isArray(value)) {
    return value as Booking[];
  }

  if (
    value &&
    typeof value === 'object' &&
    'bookings' in value
  ) {
    const result = (value as { bookings?: unknown }).bookings;

    if (Array.isArray(result)) {
      return result as Booking[];
    }
  }

  return [];
}


/*
 * Same idea for workers.
 * This prevents similar .map() errors if the worker API
 * returns { workers: [...] }.
 */
function normalizeWorkers(value: unknown): Worker[] {
  if (Array.isArray(value)) {
    return value as Worker[];
  }

  if (
    value &&
    typeof value === 'object' &&
    'workers' in value
  ) {
    const result = (value as { workers?: unknown }).workers;

    if (Array.isArray(result)) {
      return result as Worker[];
    }
  }

  return [];
}


/*
 * Format Indian currency.
 */
function amount(value: number) {
  return `₹${Number(value || 0).toFixed(2)}`;
}


function roleName(role: Role) {
  return role === 'cooperative_admin'
    ? 'cooperative admin'
    : role;
}


function formatDate(date: string) {
  if (!date) {
    return 'Date to be confirmed';
  }

  const parsed = new Date(date);

  return Number.isNaN(parsed.valueOf())
    ? date
    : parsed.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}


/* =========================================================
   COMMON SHELL
========================================================= */

function ShellPage({
  children,
}: {
  children: ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}


/* =========================================================
   METRICS
========================================================= */

function MetricGrid({
  metrics,
}: {
  metrics: Array<{
    label: string;
    value: string;
    detail: string;
    tone: string;
  }>;
}) {
  return (
    <div className="metric-grid">
      {metrics.map((metric, index) => (
        <div
          className="panel metric-card"
          style={{
            ['--metric-color' as string]:
              `hsl(var(--chart-${(index % 4) + 1}))`,
          }}
          key={metric.label}
          data-testid={`metric-${metric.label
            .toLowerCase()
            .replaceAll(' ', '-')}`}
        >
          <div className="metric-kicker">
            <span className="metric-dot" />
            {metric.label}
          </div>

          <div className="metric-value">
            {metric.value}
          </div>

          <div className="metric-detail">
            {metric.detail}
          </div>
        </div>
      ))}
    </div>
  );
}


/* =========================================================
   BOOKING ROW
========================================================= */

function BookingRow({
  booking,
  workerView = false,
  onCancel,
}: {
  booking: Booking;
  workerView?: boolean;
  onCancel?: (id: string) => void;
}) {
  const personName = workerView
    ? booking.customerName
    : booking.workerName;

  const initials =
    personName
      ?.split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2) || 'CW';

  return (
    <div
      className="list-row"
      data-testid={`row-booking-${booking.id}`}
    >
      <Avatar initials={initials} />

      <div className="list-main">
        <strong>{booking.service}</strong>

        <span>
          {personName} · {booking.address}
        </span>
      </div>

      <div className="row-end">
        <strong>{formatDate(booking.date)}</strong>
        <span>{booking.time}</span>
      </div>

      <StatusBadge status={booking.status} />

      {onCancel &&
        (booking.status === 'pending' ||
          booking.status === 'accepted') && (
          <button
            className="icon-btn"
            onClick={() => onCancel(booking.id)}
            aria-label={`Cancel ${booking.service}`}
            data-testid={`button-cancel-${booking.id}`}
          >
            <X size={14} />
          </button>
        )}
    </div>
  );
}


/* =========================================================
   RECENT BOOKINGS
========================================================= */

function RecentBookings({
  bookings,
  workerView = false,
  onCancel,
}: {
  bookings?: Booking[];
  workerView?: boolean;
  onCancel?: (id: string) => void;
}) {
  const safeBookings = normalizeBookings(bookings);

  return (
    <div className="panel panel-pad">
      <div className="section-head">
        <h2 className="section-title">
          Recent bookings
        </h2>

        <Link
          href={
            workerView
              ? '/worker/bookings'
              : '/bookings'
          }
          className="section-link"
          data-testid="link-see-all-bookings"
        >
          See all
          <ArrowRight
            size={12}
            className="inline"
          />
        </Link>
      </div>

      {safeBookings.length ? (
        safeBookings
          .slice(0, 5)
          .map((booking) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              workerView={workerView}
              onCancel={onCancel}
            />
          ))
      ) : (
        <EmptyState
          icon={CalendarClock}
          title="No bookings yet"
          message={
            workerView
              ? 'Accepted and upcoming jobs will appear here.'
              : 'Book a trusted local worker when you need a hand.'
          }
        />
      )}
    </div>
  );
}


/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard({
  role,
}: {
  role: Role;
}) {
  const summaryQuery =
    useGetDashboardSummary({ role });

  const bookingsQuery =
    useListBookings({ role });

  const queryClient = useQueryClient();

  const updateStatus =
    useUpdateBookingStatus();

  if (
    summaryQuery.isLoading ||
    bookingsQuery.isLoading
  ) {
    return (
      <ShellPage>
        <PageLoading />
      </ShellPage>
    );
  }

  if (
    summaryQuery.isError ||
    bookingsQuery.isError
  ) {
    return (
      <ShellPage>
        <PageError />
      </ShellPage>
    );
  }

  const summary = summaryQuery.data;

  /*
   * IMPORTANT FIX:
   * Always normalize the API response before using
   * .slice() or .map().
   */
  const bookings = normalizeBookings(
    bookingsQuery.data ??
      summary?.recentBookings,
  );

  const isWorker = role === 'worker';

  const isAdmin =
    role === 'cooperative_admin';

  const title = isAdmin
    ? 'Network pulse'
    : isWorker
      ? 'Ready when you are'
      : 'Good morning';

  const subtitle = isAdmin
    ? 'A clear view of the cooperative, today.'
    : isWorker
      ? 'Your next useful thing is right here.'
      : 'Here is what is happening with your services.';

  const cancelBooking = (id: string) => {
    updateStatus.mutate(
      {
        bookingId: id,
        data: {
          status: 'cancelled',
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey:
              getListBookingsQueryKey({
                role,
              }),
          });
        },
      },
    );
  };

  return (
    <ShellPage>
      <main className="page">

        <div className="page-head">
          <div>
            <p className="eyebrow">
              {isAdmin
                ? 'Operations / today'
                : isWorker
                  ? 'Your workspace'
                  : 'Customer workspace'}
            </p>

            <h1 className="page-title">
              {title}
            </h1>

            <p className="page-subtitle">
              {subtitle}
            </p>
          </div>

          {!isAdmin && (
            <Link
              href={
                isWorker
                  ? '/worker/requests'
                  : '/services'
              }
              className="btn btn-primary"
              data-testid="button-primary-dashboard"
            >
              {isWorker
                ? 'Review requests'
                : 'Book a service'}

              <ArrowRight size={14} />
            </Link>
          )}
        </div>


        <MetricGrid
          metrics={summary?.metrics || []}
        />


        <div className="two-col">

          <RecentBookings
            bookings={bookings}
            workerView={isWorker}
            onCancel={
              !isWorker && !isAdmin
                ? cancelBooking
                : undefined
            }
          />


          <div className="stack">

            <div className="panel panel-pad">

              <div className="section-head">
                <h2 className="section-title">
                  {isAdmin
                    ? 'Network note'
                    : 'Next up'}
                </h2>

                <CircleAlert
                  size={16}
                  className="text-muted-foreground"
                />
              </div>


              <div className="callout">
                <Clock3 size={17} />

                <span>
                  {bookings[0] ? (
                    <>
                      <strong>
                        {bookings[0].service}
                      </strong>{' '}
                      is{' '}
                      {bookings[0].status.replaceAll(
                        '_',
                        ' ',
                      )}{' '}
                      for{' '}
                      {formatDate(
                        bookings[0].date,
                      )}
                      .
                    </>
                  ) : (
                    'Nothing needs your attention right now. Your cooperative is ready when you are.'
                  )}
                </span>
              </div>


              <div
                className="stack"
                style={{
                  marginTop: 16,
                }}
              >

                <div className="list-row">
                  <div
                    className="empty-icon"
                    style={{
                      width: 30,
                      height: 30,
                      margin: 0,
                    }}
                  >
                    <ShieldCheck size={15} />
                  </div>

                  <div className="list-main">
                    <strong>
                      Trusted local network
                    </strong>

                    <span>
                      People-powered services,
                      coordinated nearby.
                    </span>
                  </div>
                </div>


                <div className="list-row">
                  <div
                    className="empty-icon"
                    style={{
                      width: 30,
                      height: 30,
                      margin: 0,
                    }}
                  >
                    <MapPin size={15} />
                  </div>

                  <div className="list-main">
                    <strong>
                      Cooperative{' '}
                      {isAdmin
                        ? 'control'
                        : 'support'}
                    </strong>

                    <span>
                      Questions are handled by a
                      real person.
                    </span>
                  </div>
                </div>

              </div>
            </div>


            {isAdmin && (
              <div className="panel panel-pad">

                <div className="section-head">
                  <h2 className="section-title">
                    Admin shortcuts
                  </h2>
                </div>

                <div className="stack">

                  <Link
                    className="btn btn-ghost justify-between"
                    href="/admin/workers"
                    data-testid="link-admin-workers"
                  >
                    Review worker verification
                    <ArrowRight size={14} />
                  </Link>

                  <Link
                    className="btn btn-ghost justify-between"
                    href="/admin/bookings"
                    data-testid="link-admin-bookings"
                  >
                    View booking activity
                    <ArrowRight size={14} />
                  </Link>

                </div>
              </div>
            )}

          </div>
        </div>

      </main>
    </ShellPage>
  );
}


/* =========================================================
   LOGIN PAGE
========================================================= */

export function LoginPage() {
  const [, setLocation] =
    useLocation();

  const sessionQuery =
    useGetSession();

  const [selected, setSelected] =
    useState<Role>('customer');


  const roles = [
    {
      key: 'customer' as Role,
      title: 'Customer',
      detail:
        'Find help and manage your bookings.',
      icon: UserRound,
      route: '/dashboard',
    },
    {
      key: 'worker' as Role,
      title: 'Working Professional',
      detail:
        'Manage requests, jobs, and availability.',
      icon: Wrench,
      route: '/worker/dashboard',
    },
    {
      key: 'cooperative_admin' as Role,
      title: 'Cooperative admin',
      detail:
        'Oversee people and booking activity.',
      icon: UsersRound,
      route: '/admin/dashboard',
    },
  ];


  const continueDemo = () => {
    window.localStorage.setItem(
      'coopwork-role',
      selected,
    );

    const selectedRole = roles.find(
      (item) => item.key === selected,
    );

    setLocation(
      selectedRole?.route ||
        '/dashboard',
    );
  };


  return (
    <div className="login-page">

      <section className="login-rail">

        <div>

          <div
            className="sidebar-brand"
            style={{
              padding: 0,
              marginBottom: 60,
            }}
          >
            <div className="brand-mark">
              cw
            </div>

            <div className="brand-name">
              CoopWork
            </div>
          </div>


          <h1 className="login-hero-title">
  Good work,
  <br />
  close to home.
</h1>
<p className="login-hero-description">
  A shared dashboard for the people who make local services work —
  customers, workers, and the cooperative between them.
</p>

        </div>


        <div className="login-quote">
          “The clearest next step is usually
          the most helpful one.”
          <br />

          <span
            style={{
              opacity: 0.5,
            }}
          >
            CoopWork principles
          </span>
        </div>

      </section>


      <main className="login-main">

        <div className="login-card">

          <p className="eyebrow">
            India demo workspace
          </p>

          <h2
            className="page-title"
            style={{
              fontSize: 32,
            }}
          >
            Choose how to enter
          </h2>

          <p className="page-subtitle">
            This demo changes the navigation
            and data view for the role you
            select.
          </p>


          <div className="role-options">

            {roles.map(
              ({
                key,
                title,
                detail,
                icon: Icon,
              }) => (
                <button
                  key={key}
                  className={`role-option ${
                    selected === key
                      ? 'selected'
                      : ''
                  }`}
                  onClick={() =>
                    setSelected(key)
                  }
                  data-testid={`button-role-${key}`}
                >

                  <div className="role-icon">
                    <Icon size={17} />
                  </div>

                  <div>
                    <strong>
                      {title}
                    </strong>

                    <span>
                      {detail}
                    </span>
                  </div>

                  {selected === key && (
                    <Check
                      size={16}
                      className="ml-auto text-primary"
                    />
                  )}

                </button>
              ),
            )}

          </div>


          <button
            className="btn btn-primary w-full"
            onClick={continueDemo}
            data-testid="button-enter-demo"
          >
            Enter as{' '}
            {
              roles.find(
                (item) =>
                  item.key === selected,
              )?.title
            }

            <ArrowRight size={15} />
          </button>


          {sessionQuery.data && (
            <p
              className="text-center text-xs text-muted-foreground mt-4"
              data-testid="text-session-note"
            >
              Last active session:{' '}
              {sessionQuery.data.name}
            </p>
          )}

        </div>

      </main>

    </div>
  );
}


/* =========================================================
   DASHBOARD EXPORTS
========================================================= */

export function CustomerDashboard() {
  return (
    <Dashboard role="customer" />
  );
}

export function WorkerDashboard() {
  return (
    <Dashboard role="worker" />
  );
}

export function AdminDashboard() {
  return (
    <Dashboard
      role="cooperative_admin"
    />
  );
}


/* =========================================================
   BOOKING MODAL
========================================================= */

function BookingModal({
  worker,
  close,
}: {
  worker: Worker;
  close: () => void;
}) {
  const queryClient =
    useQueryClient();

  const createBooking =
    useCreateBooking();

  const [form, setForm] =
    useState({
      service: worker.skill,
      date: '',
      time: '',
      address: '',
      description: '',
    });


  const update = (
    key: keyof typeof form,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };


  const submit = (
    event: FormEvent,
  ) => {
    event.preventDefault();

    createBooking.mutate(
      {
        data: {
          workerId: worker.id,
          ...form,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey:
              getListBookingsQueryKey({
                role: 'customer',
              }),
          });

          close();
        },
      },
    );
  };


  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-primary/35 p-4"
      role="dialog"
      aria-modal="true"
      data-testid="dialog-booking"
    >

      <div className="panel form-card w-full p-5 max-h-[90vh] overflow-auto">

        <div className="section-head">

          <div>
            <p className="eyebrow">
              New booking
            </p>

            <h2
              className="section-title"
              style={{
                fontSize: 20,
              }}
            >
              Book {worker.name}
            </h2>
          </div>


          <button
            className="icon-btn"
            onClick={close}
            aria-label="Close booking form"
            data-testid="button-close-booking"
          >
            <X size={16} />
          </button>

        </div>


        <form onSubmit={submit}>

          <div className="form-grid">

            <div className="field full">
              <label>
                Service
              </label>

              <input
                className="field-input"
                value={form.service}
                onChange={(e) =>
                  update(
                    'service',
                    e.target.value,
                  )
                }
                required
                data-testid="input-booking-service"
              />
            </div>


            <div className="field">
              <label>
                Preferred date
              </label>

              <input
                className="field-input"
                type="date"
                value={form.date}
                onChange={(e) =>
                  update(
                    'date',
                    e.target.value,
                  )
                }
                required
                data-testid="input-booking-date"
              />
            </div>


            <div className="field">
              <label>
                Preferred time
              </label>

              <input
                className="field-input"
                type="time"
                value={form.time}
                onChange={(e) =>
                  update(
                    'time',
                    e.target.value,
                  )
                }
                required
                data-testid="input-booking-time"
              />
            </div>


            <div className="field full">
              <label>
                Address
              </label>

              <input
                className="field-input"
                value={form.address}
                onChange={(e) =>
                  update(
                    'address',
                    e.target.value,
                  )
                }
                placeholder="House no., street, area, city, state"
                required
                data-testid="input-booking-address"
              />
            </div>


            <div className="field full">
              <label>
                What needs doing?
              </label>

              <textarea
                className="field-textarea"
                value={form.description}
                onChange={(e) =>
                  update(
                    'description',
                    e.target.value,
                  )
                }
                placeholder="A few helpful details for your worker"
                required
                data-testid="input-booking-description"
              />
            </div>

          </div>


          <div className="form-actions">

            <button
              type="button"
              className="btn btn-ghost"
              onClick={close}
              data-testid="button-cancel-booking"
            >
              Not now
            </button>


            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                createBooking.isPending
              }
              data-testid="button-submit-booking"
            >
              {createBooking.isPending
                ? 'Sending request…'
                : 'Send booking request'}

              <ArrowRight size={14} />
            </button>

          </div>

        </form>

      </div>

    </div>
  );
}


/* =========================================================
   SERVICES PAGE
========================================================= */

export function ServicesPage() {
  const [service, setService] =
    useState('');

  const [availability, setAvailability] =
    useState('');

  const [minRating, setMinRating] =
    useState('');

  const [search, setSearch] =
    useState('');

  const [selectedWorker, setSelectedWorker] =
    useState<Worker | null>(null);


  const query = useListWorkers({
    service: service || null,
    availability:
      availability || null,
    minRating: minRating
      ? Number(minRating)
      : null,
  });


  const workers = normalizeWorkers(
    query.data,
  ).filter((worker) =>
    `${worker.name} ${worker.skill} ${worker.location}`
      .toLowerCase()
      .includes(
        search.toLowerCase(),
      ),
  );


  return (
    <ShellPage>
      <main className="page">

        <div className="page-head">

          <div>

            <p className="eyebrow">
              People you can count on
            </p>

            <h1 className="page-title">
              Find a service
            </h1>

            <p className="page-subtitle">
              Browse skilled workers in your
              cooperative and book in a few
              clear steps.
            </p>

          </div>

        </div>


        <div className="toolbar">

          <div className="search-box">

            <Search size={15} />

            <input
              placeholder="Search skill or location"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              data-testid="input-search-workers"
            />

          </div>


          <select
            className="filter-select"
            value={service}
            onChange={(e) =>
              setService(e.target.value)
            }
            data-testid="select-service"
          >
            <option value="">
              All services
            </option>

            <option value="Home repair">
              Home repair
            </option>

            <option value="Cleaning">
              Cleaning
            </option>

            <option value="Moving">
              Moving
            </option>

            <option value="Gardening">
              Gardening
            </option>
          </select>


          <select
            className="filter-select"
            value={availability}
            onChange={(e) =>
              setAvailability(
                e.target.value,
              )
            }
            data-testid="select-availability"
          >
            <option value="">
              Any availability
            </option>

            <option value="Available">
              Available now
            </option>

            <option value="Busy">
              Busy
            </option>
          </select>


          <select
            className="filter-select"
            value={minRating}
            onChange={(e) =>
              setMinRating(
                e.target.value,
              )
            }
            data-testid="select-rating"
          >
            <option value="">
              Any rating
            </option>

            <option value="4">
              4.0+ stars
            </option>

            <option value="4.5">
              4.5+ stars
            </option>
          </select>

        </div>


        <div className="three-col">

          {query.isLoading ? (
            [1, 2, 3].map((n) => (
              <div
                className="panel p-5"
                key={n}
              >
                <div
                  className="skeleton"
                  style={{
                    height: 38,
                    width: 38,
                  }}
                />

                <div
                  className="skeleton"
                  style={{
                    height: 15,
                    width: '65%',
                    marginTop: 15,
                  }}
                />

                <div
                  className="skeleton"
                  style={{
                    height: 11,
                    width: '85%',
                    marginTop: 10,
                  }}
                />
              </div>
            ))
          ) : workers.length ? (
            workers.map((worker) => (
              <div
                className="panel panel-pad"
                key={worker.id}
                data-testid={`card-worker-${worker.id}`}
              >

                <div className="flex justify-between items-start">

                  <Avatar
                    initials={worker.initials}
                    tone="gold"
                  />

                  {worker.verified && (
                    <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                      <ShieldCheck size={13} />
                      Verified
                    </span>
                  )}

                </div>


                <h2 className="font-display text-lg mt-4 tracking-tight">
                  {worker.name}
                </h2>


                <p className="text-xs text-muted-foreground mt-1">
                  {worker.skill} ·{' '}
                  {worker.location}
                </p>


                <div className="flex gap-4 mt-4 text-xs">

                  <span className="flex items-center gap-1 text-amber-700">
                    <Star
                      size={13}
                      fill="currentColor"
                    />
                    {worker.rating.toFixed(
                      1,
                    )}
                  </span>

                  <span className="text-muted-foreground">
                    {worker.experience}
                  </span>

                </div>


                <div className="flex items-center justify-between mt-5 pt-4 border-t">

                  <StatusBadge
                    status={worker.availability.toLowerCase()}
                  />

                  <button
                    className="btn btn-primary"
                    onClick={() =>
                      setSelectedWorker(
                        worker,
                      )
                    }
                    disabled={
                      worker.availability !==
                      'Available'
                    }
                    data-testid={`button-book-worker-${worker.id}`}
                  >
                    Book worker
                  </button>

                </div>

              </div>
            ))
          ) : (
            <div className="panel col-span-full">

              <EmptyState
                icon={Search}
                title="No workers match those filters"
                message="Try a broader service or remove one of the filters."
              />

            </div>
          )}

        </div>


        {selectedWorker && (
          <BookingModal
            worker={selectedWorker}
            close={() =>
              setSelectedWorker(null)
            }
          />
        )}

      </main>
    </ShellPage>
  );
}


/* =========================================================
   BOOKINGS PAGE
========================================================= */

export function BookingsPage({
  workerView = false,
  adminView = false,
}: {
  workerView?: boolean;
  adminView?: boolean;
}) {
  const [filter, setFilter] =
    useState<BookingFilter>('all');


  const role: Role = adminView
    ? 'cooperative_admin'
    : workerView
      ? 'worker'
      : 'customer';


  const query = useListBookings({
    role,
    status:
      filter === 'all'
        ? null
        : filter,
  });


  /*
   * IMPORTANT FIX:
   * Normalize query.data before .length/.map().
   */
  const bookings = normalizeBookings(
    query.data,
  );


  const queryClient =
    useQueryClient();

  const updateStatus =
    useUpdateBookingStatus();


  const title = adminView
    ? 'Booking oversight'
    : workerView
      ? 'My jobs'
      : 'My bookings';


  const subtitle = adminView
    ? 'Keep an eye on service flow across the network.'
    : workerView
      ? 'Every accepted request, in one dependable list.'
      : 'Track what is next, in progress, and complete.';


  const cancel = (id: string) => {
    updateStatus.mutate(
      {
        bookingId: id,
        data: {
          status: 'cancelled',
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey:
              getListBookingsQueryKey({
                role,
                ...(filter === 'all'
                  ? {}
                  : {
                      status: filter,
                    }),
              }),
          });
        },
      },
    );
  };


  const filters: BookingFilter[] = [
    'all',
    'pending',
    'accepted',
    'in_progress',
    'completed',
    'cancelled',
  ];


  return (
    <ShellPage>
      <main className="page">

        <div className="page-head">

          <div>

            <p className="eyebrow">
              {adminView
                ? 'Cooperative operations'
                : workerView
                  ? 'Your work'
                  : 'Your activity'}
            </p>

            <h1 className="page-title">
              {title}
            </h1>

            <p className="page-subtitle">
              {subtitle}
            </p>

          </div>


          {!workerView &&
            !adminView && (
              <Link
                href="/services"
                className="btn btn-primary"
                data-testid="button-new-booking"
              >
                <Plus size={15} />
                New booking
              </Link>
            )}

        </div>


        <div className="toolbar">

          {filters.map((item) => (
            <button
              key={item}
              className={`btn ${
                filter === item
                  ? 'btn-secondary'
                  : 'btn-ghost'
              }`}
              onClick={() =>
                setFilter(item)
              }
              data-testid={`button-filter-${item}`}
            >
              {item === 'all'
                ? 'All bookings'
                : item.replaceAll(
                    '_',
                    ' ',
                  )}
            </button>
          ))}

        </div>


        <div className="panel panel-pad">

          {query.isLoading ? (
            <div className="stack">

              {[1, 2, 3, 4].map(
                (n) => (
                  <div
                    className="skeleton"
                    style={{
                      height: 57,
                    }}
                    key={n}
                  />
                ),
              )}

            </div>
          ) : query.isError ? (
            <PageError message="Bookings are temporarily unavailable." />
          ) : bookings.length ? (
            bookings.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                workerView={workerView}
                onCancel={
                  !adminView &&
                  !workerView
                    ? cancel
                    : undefined
                }
              />
            ))
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="No bookings in this view"
              message="When there is activity here, it will be easy to spot."
              action={
                !workerView &&
                !adminView ? (
                  <Link
                    href="/services"
                    className="btn btn-primary"
                    data-testid="button-empty-book"
                  >
                    Find a worker
                  </Link>
                ) : undefined
              }
            />
          )}

        </div>

      </main>
    </ShellPage>
  );
}


/* =========================================================
   COMPLAINTS PAGE
========================================================= */

export function ComplaintsPage() {
  const query =
    useListComplaints();

  const createComplaint =
    useCreateComplaint();

  const queryClient =
    useQueryClient();

  const [open, setOpen] =
    useState(false);

  const [form, setForm] =
    useState({
      subject: '',
      description: '',
    });


  const complaints: Complaint[] =
    Array.isArray(query.data)
      ? query.data
      : query.data &&
          typeof query.data === 'object' &&
          'complaints' in query.data &&
          Array.isArray(
            (
              query.data as {
                complaints?: unknown;
              }
            ).complaints,
          )
        ? (
            query.data as {
              complaints: Complaint[];
            }
          ).complaints
        : [];


  const submit = (
    event: FormEvent,
  ) => {
    event.preventDefault();

    createComplaint.mutate(
      {
        data: form,
      },
      {
        onSuccess: () => {
          setForm({
            subject: '',
            description: '',
          });

          setOpen(false);

          queryClient.invalidateQueries({
            queryKey:
              getListComplaintsQueryKey(),
          });
        },
      },
    );
  };


  return (
    <ShellPage>
      <main className="page">

        <div className="page-head">

          <div>

            <p className="eyebrow">
              Support that stays human
            </p>

            <h1 className="page-title">
              Complaints
            </h1>

            <p className="page-subtitle">
              Raise a concern and the
              cooperative will keep you posted.
            </p>

          </div>


          <button
            className="btn btn-primary"
            onClick={() =>
              setOpen(true)
            }
            data-testid="button-new-complaint"
          >
            <Plus size={15} />
            New complaint
          </button>

        </div>


        <div className="two-col">

          <div className="panel panel-pad">

            {query.isLoading ? (
              <div className="stack">
                {[1, 2, 3].map(
                  (n) => (
                    <div
                      className="skeleton"
                      style={{
                        height: 68,
                      }}
                      key={n}
                    />
                  ),
                )}
              </div>
            ) : complaints.length ? (
              complaints.map(
                (complaint) => (
                  <div
                    className="list-row"
                    key={complaint.id}
                    data-testid={`row-complaint-${complaint.id}`}
                  >

                    <div
                      className="empty-icon"
                      style={{
                        width: 34,
                        height: 34,
                        margin: 0,
                      }}
                    >
                      <FileWarning
                        size={16}
                      />
                    </div>


                    <div className="list-main">

                      <strong>
                        {complaint.subject}
                      </strong>

                      <span>
                        {formatDate(
                          complaint.createdAt,
                        )}{' '}
                        ·{' '}
                        {complaint.description}
                      </span>

                    </div>


                    <StatusBadge
                      status={
                        complaint.status
                      }
                    />

                  </div>
                ),
              )
            ) : (
              <EmptyState
                icon={FileWarning}
                title="No complaints"
                message="If something feels off, tell us. Your concern will be seen by the cooperative."
                action={
                  <button
                    className="btn btn-primary"
                    onClick={() =>
                      setOpen(true)
                    }
                    data-testid="button-empty-complaint"
                  >
                    Start a complaint
                  </button>
                }
              />
            )}

          </div>


          <div className="panel panel-pad">

            <div className="section-head">

              <h2 className="section-title">
                What happens next
              </h2>

              <ShieldCheck size={16} />

            </div>


            <div className="stack">

              <div className="callout">
                <span className="font-mono-app">
                  01
                </span>

                <span>
                  We acknowledge your
                  complaint and review the
                  details.
                </span>
              </div>


              <div className="callout">
                <span className="font-mono-app">
                  02
                </span>

                <span>
                  A cooperative admin follows
                  up with the people involved.
                </span>
              </div>


              <div className="callout">
                <span className="font-mono-app">
                  03
                </span>

                <span>
                  You see the resolution here,
                  with a clear status.
                </span>
              </div>

            </div>

          </div>

        </div>


        {open && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-primary/35 p-4">

            <div className="panel form-card w-full p-5">

              <div className="section-head">

                <div>

                  <p className="eyebrow">
                    Support request
                  </p>

                  <h2
                    className="section-title"
                    style={{
                      fontSize: 20,
                    }}
                  >
                    Tell us what happened
                  </h2>

                </div>


                <button
                  className="icon-btn"
                  onClick={() =>
                    setOpen(false)
                  }
                  data-testid="button-close-complaint"
                >
                  <X size={16} />
                </button>

              </div>


              <form onSubmit={submit}>

                <div className="stack">

                  <div className="field">

                    <label>
                      Subject
                    </label>

                    <input
                      className="field-input"
                      value={form.subject}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          subject:
                            e.target.value,
                        })
                      }
                      required
                      data-testid="input-complaint-subject"
                    />

                  </div>


                  <div className="field">

                    <label>
                      Details
                    </label>

                    <textarea
                      className="field-textarea"
                      value={
                        form.description
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          description:
                            e.target.value,
                        })
                      }
                      required
                      data-testid="input-complaint-description"
                    />

                  </div>

                </div>


                <div className="form-actions">

                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() =>
                      setOpen(false)
                    }
                    data-testid="button-cancel-complaint"
                  >
                    Cancel
                  </button>


                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={
                      createComplaint.isPending
                    }
                    data-testid="button-submit-complaint"
                  >
                    {createComplaint.isPending
                      ? 'Sending…'
                      : 'Submit complaint'}
                  </button>

                </div>

              </form>

            </div>

          </div>
        )}

      </main>
    </ShellPage>
  );
}


/* =========================================================
   WORKER REQUESTS
========================================================= */

export function RequestsPage() {
  const query =
    useListBookings({
      role: 'worker',
      status: 'pending',
    });

  const queryClient =
    useQueryClient();

  const updateStatus =
    useUpdateBookingStatus();


  /*
   * IMPORTANT FIX:
   * Normalize worker booking response.
   */
  const bookings = normalizeBookings(
    query.data,
  );


  const respond = (
    id: string,
    status:
      | 'accepted'
      | 'rejected',
  ) => {
    updateStatus.mutate(
      {
        bookingId: id,
        data: {
          status,
        },
      },
      {
        onSuccess: () => {

          queryClient.invalidateQueries({
            queryKey:
              getListBookingsQueryKey({
                role: 'worker',
                status: 'pending',
              }),
          });


          queryClient.invalidateQueries({
            queryKey:
              getGetDashboardSummaryQueryKey(
                {
                  role: 'worker',
                },
              ),
          });

        },
      },
    );
  };


  return (
    <ShellPage>
      <main className="page">

        <div className="page-head">

          <div>

            <p className="eyebrow">
              New opportunities
            </p>

            <h1 className="page-title">
              Job requests
            </h1>

            <p className="page-subtitle">
              Review the details, then make
              the next move that works for you.
            </p>

          </div>

        </div>


        <div className="stack">

          {query.isLoading ? (
            [1, 2].map((n) => (
              <div
                className="panel p-5 skeleton"
                style={{
                  height: 190,
                }}
                key={n}
              />
            ))
          ) : bookings.length ? (
            bookings.map((booking) => (
              <div
                className="panel panel-pad"
                key={booking.id}
                data-testid={`card-request-${booking.id}`}
              >

                <div className="flex justify-between gap-5">

                  <div>

                    <p className="eyebrow">
                      {booking.service}
                    </p>

                    <h2 className="font-display text-2xl tracking-tight">
                      {booking.customerName}
                    </h2>

                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">

                      <CalendarClock
                        size={13}
                      />

                      {formatDate(
                        booking.date,
                      )}{' '}
                      at {booking.time}

                      ·

                      <MapPin size={13} />

                      {booking.address}

                    </p>

                  </div>


                  <div className="text-right">

                    <strong className="font-mono-app text-lg">
                      {amount(
                        booking.amount,
                      )}
                    </strong>

                    <p className="text-[10px] text-muted-foreground mt-1">
                      estimated total
                    </p>

                  </div>

                </div>


                <p className="text-sm text-muted-foreground mt-5 max-w-2xl">
                  {booking.description}
                </p>


                <div className="form-actions">

                  <button
                    className="btn btn-danger"
                    onClick={() =>
                      respond(
                        booking.id,
                        'rejected',
                      )
                    }
                    disabled={
                      updateStatus.isPending
                    }
                    data-testid={`button-reject-${booking.id}`}
                  >
                    <X size={14} />
                    Decline
                  </button>


                  <button
                    className="btn btn-primary"
                    onClick={() =>
                      respond(
                        booking.id,
                        'accepted',
                      )
                    }
                    disabled={
                      updateStatus.isPending
                    }
                    data-testid={`button-accept-${booking.id}`}
                  >
                    <Check size={14} />
                    Accept request
                  </button>

                </div>

              </div>
            ))
          ) : (
            <div className="panel">

              <EmptyState
                icon={ClipboardList}
                title="You are all caught up"
                message="New customer requests will arrive here with the details you need to decide."
              />

            </div>
          )}

        </div>

      </main>
    </ShellPage>
  );
}


/* =========================================================
   AVAILABILITY
========================================================= */

export function AvailabilityPage() {
  const query =
    useGetAvailability();

  const updateAvailability =
    useUpdateAvailability();

  const queryClient =
    useQueryClient();


  const initial: Availability =
    query.data || {
      available: true,
      days: [
        'Mon',
        'Tue',
        'Wed',
        'Thu',
        'Fri',
      ],
      startTime: '09:00',
      endTime: '17:00',
    };


  const [available, setAvailable] =
    useState<boolean | null>(null);

  const [days, setDays] =
    useState<string[] | null>(null);

  const [startTime, setStartTime] =
    useState<string | null>(null);

  const [endTime, setEndTime] =
    useState<string | null>(null);


  const current = {
    available:
      available ??
      initial.available,

    days:
      days ??
      initial.days,

    startTime:
      startTime ??
      initial.startTime,

    endTime:
      endTime ??
      initial.endTime,
  };


  const week = [
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
    'Sun',
  ];


  const save = () =>
    updateAvailability.mutate(
      {
        data: current,
      },
      {
        onSuccess: () =>
          queryClient.invalidateQueries(
            {
              queryKey:
                getGetAvailabilityQueryKey(),
            },
          ),
      },
    );


  return (
    <ShellPage>
      <main className="page">

        <div className="page-head">

          <div>

            <p className="eyebrow">
              Set a useful boundary
            </p>

            <h1 className="page-title">
              Availability
            </h1>

            <p className="page-subtitle">
              Customers only see times when
              you are ready to take work.
            </p>

          </div>


          <button
            className="btn btn-primary"
            onClick={save}
            disabled={
              updateAvailability.isPending
            }
            data-testid="button-save-availability"
          >
            {updateAvailability.isPending
              ? 'Saving…'
              : 'Save availability'}
          </button>

        </div>


        <div className="two-col">

          <div className="panel panel-pad">

            <div className="toggle-line">

              <div>

                <strong className="text-sm">
                  Available for new work
                </strong>

                <p className="text-xs text-muted-foreground mt-1">
                  Pause this when your
                  schedule is full.
                </p>

              </div>


              <button
                className={`toggle ${
                  current.available
                    ? 'on'
                    : ''
                }`}
                onClick={() =>
                  setAvailable(
                    !current.available,
                  )
                }
                aria-label="Toggle availability"
                data-testid="toggle-availability"
              >
                <span />
              </button>

            </div>


            <div
              className="section-head"
              style={{
                marginTop: 23,
              }}
            >

              <h2 className="section-title">
                Working days
              </h2>

              <span className="text-[10px] text-muted-foreground">
                {current.days.length}{' '}
                days selected
              </span>

            </div>


            <div className="calendar-grid">

              {week.map((day) => (
                <button
                  key={day}
                  className={`day-toggle ${
                    current.days.includes(
                      day,
                    )
                      ? 'selected'
                      : ''
                  }`}
                  onClick={() =>
                    setDays(
                      current.days.includes(
                        day,
                      )
                        ? current.days.filter(
                            (item) =>
                              item !== day,
                          )
                        : [
                            ...current.days,
                            day,
                          ],
                    )
                  }
                  data-testid={`button-day-${day.toLowerCase()}`}
                >
                  {day}
                </button>
              ))}

            </div>


            <div
              className="form-grid"
              style={{
                marginTop: 24,
              }}
            >

              <div className="field">

                <label>
                  Start time
                </label>

                <input
                  className="field-input"
                  type="time"
                  value={
                    current.startTime
                  }
                  onChange={(e) =>
                    setStartTime(
                      e.target.value,
                    )
                  }
                  data-testid="input-start-time"
                />

              </div>


              <div className="field">

                <label>
                  End time
                </label>

                <input
                  className="field-input"
                  type="time"
                  value={
                    current.endTime
                  }
                  onChange={(e) =>
                    setEndTime(
                      e.target.value,
                    )
                  }
                  data-testid="input-end-time"
                />

              </div>

            </div>

          </div>


          <div className="panel panel-pad">

            <div className="section-head">

              <h2 className="section-title">
                Your schedule, at a glance
              </h2>

              <CalendarClock size={16} />

            </div>


            <div className="callout">

              <Clock3 size={16} />

              <span>
                You are open{' '}
                <strong>
                  {current.startTime}–
                  {current.endTime}
                </strong>{' '}
                on{' '}
                {current.days.length
                  ? current.days.join(
                      ', ',
                    )
                  : 'no selected days'}
                .
              </span>

            </div>


            <div className="empty-state">

              <div className="empty-icon">
                <ShieldCheck size={20} />
              </div>

              <strong>
                You stay in control
              </strong>

              <p>
                Availability can be updated
                whenever life changes.
                Existing accepted jobs are
                not affected.
              </p>

            </div>

          </div>

        </div>

      </main>
    </ShellPage>
  );
}


/* =========================================================
   EARNINGS
========================================================= */

export function EarningsPage() {
  const summaryQuery =
    useGetDashboardSummary({
      role: 'worker',
    });

  const bookingsQuery =
    useListBookings({
      role: 'worker',
      status: 'completed',
    });


  /*
   * IMPORTANT FIX:
   */
  const bookings = normalizeBookings(
    bookingsQuery.data,
  );


  const total = bookings.reduce(
    (sum, booking) =>
      sum + Number(booking.amount || 0),
    0,
  );


  const metrics =
    summaryQuery.data?.metrics || [];


  return (
    <ShellPage>
      <main className="page">

        <div className="page-head">

          <div>

            <p className="eyebrow">
              Your contribution, counted
            </p>

            <h1 className="page-title">
              Earnings
            </h1>

            <p className="page-subtitle">
              A straightforward view of
              completed work and what it
              brought in.
            </p>

          </div>

        </div>


        <div className="two-col">

          <div className="stack">

            <div className="panel panel-pad earnings-hero">

              <p
                className="eyebrow"
                style={{
                  color: 'inherit',
                  opacity: 0.7,
                }}
              >
                Completed work total
              </p>

              <div className="earnings-amount">
                {amount(total)}
              </div>

              <p className="text-xs mt-3 opacity-70">
                {bookings.length}{' '}
                completed{' '}
                {bookings.length === 1
                  ? 'job'
                  : 'jobs'}{' '}
                in the current view
              </p>

            </div>


            <div
              className="metric-grid"
              style={{
                marginBottom: 0,
                gridTemplateColumns:
                  'repeat(2,minmax(0,1fr))',
              }}
            >

              {metrics
                .slice(0, 2)
                .map((metric) => (
                  <div
                    className="panel metric-card"
                    key={metric.label}
                  >

                    <div className="metric-kicker">
                      {metric.label}
                    </div>

                    <div className="metric-value">
                      {metric.value}
                    </div>

                    <div className="metric-detail">
                      {metric.detail}
                    </div>

                  </div>
                ))}

            </div>

          </div>


          <div className="panel panel-pad">

            <div className="section-head">

              <h2 className="section-title">
                Completed jobs
              </h2>

              <span className="font-mono-app text-xs text-muted-foreground">
                {bookings.length}
              </span>

            </div>


            {bookings.length ? (
              bookings.map(
                (booking) => (
                  <BookingRow
                    booking={booking}
                    key={booking.id}
                    workerView
                  />
                ),
              )
            ) : (
              <EmptyState
                icon={CircleDollarSign}
                title="No completed jobs yet"
                message="Once a job is marked complete, its amount will appear here."
              />
            )}

          </div>

        </div>

      </main>
    </ShellPage>
  );
}


/* =========================================================
   ADMIN WORKERS
========================================================= */

export function AdminWorkersPage() {
  const query =
    useListAdminWorkers();

  const updateVerification =
    useUpdateWorkerVerification();

  const queryClient =
    useQueryClient();


  const workers = normalizeWorkers(
    query.data,
  );


  const toggle = (
    worker: Worker,
  ) => {
    updateVerification.mutate(
      {
        workerId: worker.id,
        data: {
          verified:
            !worker.verified,
          enabled:
            !worker.verified,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries(
            {
              queryKey:
                getListAdminWorkersQueryKey(),
            },
          );
        },
      },
    );
  };


  return (
    <ShellPage>
      <main className="page">

        <div className="page-head">

          <div>

            <p className="eyebrow">
              People behind the service
            </p>

            <h1 className="page-title">
              Workers
            </h1>

            <p className="page-subtitle">
              Verify trusted workers and keep
              the cooperative directory current.
            </p>

          </div>

        </div>


        <div className="panel panel-pad">

          <div className="toolbar">

            <div className="callout flex-1">

              <ShieldCheck size={16} />

              <span>
                Verification gives customers a
                clear signal that a worker has
                been reviewed by the cooperative.
              </span>

            </div>

          </div>


          <div className="table-wrap">

            <table className="data-table">

              <thead>

                <tr>
                  <th>Worker</th>
                  <th>Speciality</th>
                  <th>Location</th>
                  <th>Rating</th>
                  <th>Availability</th>
                  <th>Verification</th>
                  <th />
                </tr>

              </thead>


              <tbody>

                {query.isLoading ? (
                  [1, 2, 3].map(
                    (n) => (
                      <tr key={n}>
                        <td colSpan={7}>
                          <div
                            className="skeleton"
                            style={{
                              height: 35,
                            }}
                          />
                        </td>
                      </tr>
                    ),
                  )
                ) : (
                  workers.map(
                    (worker) => (
                      <tr
                        key={worker.id}
                        data-testid={`row-worker-${worker.id}`}
                      >

                        <td>

                          <div className="table-person">

                            <Avatar
                              initials={
                                worker.initials
                              }
                            />

                            <div>

                              <strong>
                                {worker.name}
                              </strong>

                              <span>
                                {
                                  worker.experience
                                }
                              </span>

                            </div>

                          </div>

                        </td>


                        <td>
                          {worker.skill}
                        </td>

                        <td>
                          {worker.location}
                        </td>


                        <td>

                          <span className="stars">
                            ★
                          </span>{' '}

                          {worker.rating.toFixed(
                            1,
                          )}

                        </td>


                        <td>

                          <StatusBadge
                            status={worker.availability.toLowerCase()}
                          />

                        </td>


                        <td>

                          {worker.verified ? (
                            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">

                              <ShieldCheck
                                size={14}
                              />

                              Verified

                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Needs review
                            </span>
                          )}

                        </td>


                        <td>

                          <button
                            className={`btn ${
                              worker.verified
                                ? 'btn-ghost'
                                : 'btn-secondary'
                            }`}
                            onClick={() =>
                              toggle(worker)
                            }
                            disabled={
                              updateVerification.isPending
                            }
                            data-testid={`button-verify-${worker.id}`}
                          >
                            {worker.verified
                              ? 'Revoke'
                              : 'Verify'}
                          </button>

                        </td>

                      </tr>
                    ),
                  )
                )}

              </tbody>

            </table>

          </div>


          {!query.isLoading &&
            !workers.length && (
              <EmptyState
                icon={UsersRound}
                title="No workers to review"
                message="New worker profiles will appear here."
              />
            )}

        </div>

      </main>
    </ShellPage>
  );
}


/* =========================================================
   PROFILE
========================================================= */

export function ProfilePage() {
  const sessionQuery =
    useGetSession();

  const reviewsQuery =
    useListReviews();

  const session =
    sessionQuery.data;


  return (
    <ShellPage>
      <main className="page">

        <div className="page-head">

          <div>

            <p className="eyebrow">
              Shared account
            </p>

            <h1 className="page-title">
              Profile
            </h1>

            <p className="page-subtitle">
              The details your cooperative uses
              to keep work personal.
            </p>

          </div>

        </div>


        <div className="two-col">

          <div className="stack">

            <div className="panel panel-pad">

              <div className="flex items-center gap-4">

                <div
                  className="avatar"
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 16,
                    fontSize: 16,
                  }}
                >
                  {session?.name
                    ?.slice(0, 2)
                    .toUpperCase() ||
                    'CW'}
                </div>


                <div>

                  <h2
                    className="font-display text-2xl tracking-tight"
                    data-testid="text-profile-name"
                  >
                    {session?.name ||
                      'Your profile'}
                  </h2>

                  <p className="text-xs text-muted-foreground mt-1">
                    {session?.email}
                  </p>

                </div>

              </div>


              <div
                className="form-grid"
                style={{
                  marginTop: 25,
                }}
              >

                <div className="field">

                  <label>
                    Full name
                  </label>

                  <input
                    className="field-input"
                    defaultValue={
                      session?.name || ''
                    }
                    data-testid="input-profile-name"
                  />

                </div>


                <div className="field">

                  <label>
                    Email
                  </label>

                  <input
                    className="field-input"
                    defaultValue={
                      session?.email || ''
                    }
                    type="email"
                    data-testid="input-profile-email"
                  />

                </div>


                <div className="field">

                  <label>
                    Role
                  </label>

                  <input
                    className="field-input"
                    value={roleName(
                      (session?.role ||
                        'customer') as Role,
                    )}
                    readOnly
                    data-testid="input-profile-role"
                  />

                </div>


                <div className="field">

                  <label>
                    Cooperative ID
                  </label>

                  <input
                    className="field-input font-mono-app"
                    value={
                      session?.cooperativeId ||
                      '—'
                    }
                    readOnly
                    data-testid="input-profile-cooperative"
                  />

                </div>

              </div>


              <div className="form-actions">

                <button
                  className="btn btn-primary"
                  onClick={() =>
                    window.alert(
                      'Profile details are managed by your cooperative admin.',
                    )
                  }
                  data-testid="button-save-profile"
                >
                  Save changes
                </button>

              </div>

            </div>


            <div className="callout">

              <ShieldCheck size={17} />

              <span>
                Your profile is visible only to
                the cooperative members who need
                it to coordinate a service.
              </span>

            </div>

          </div>


          <div className="panel panel-pad">

            <div className="section-head">

              <h2 className="section-title">
                Recent feedback
              </h2>

              <Star size={16} />

            </div>


            {Array.isArray(
              reviewsQuery.data,
            ) &&
            reviewsQuery.data.length ? (
              reviewsQuery.data
                .slice(0, 4)
                .map((review) => (
                  <div
                    className="review-card border-b last:border-0"
                    key={review.id}
                    data-testid={`review-${review.id}`}
                  >

                    <div className="flex justify-between">

                      <strong className="text-xs">
                        {review.reviewer}
                      </strong>

                      <span className="stars">
                        {'★'.repeat(
                          review.rating,
                        )}
                      </span>

                    </div>


                    <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                      “{review.comment}”
                    </p>


                    <p className="text-[10px] text-muted-foreground mt-3">
                      {review.subject} ·{' '}
                      {formatDate(
                        review.date,
                      )}
                    </p>

                  </div>
                ))
            ) : (
              <EmptyState
                icon={Star}
                title="No feedback yet"
                message="Reviews will appear here after completed work."
              />
            )}

          </div>

        </div>

      </main>
    </ShellPage>
  );
}