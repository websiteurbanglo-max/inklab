import { useState } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useActionData, Form, redirect } from "react-router";
import { searchOrders } from "../models/order.server";
import { getAllShops } from "../models/shop.server";

// ---------- Auth helpers ----------
const SESSION_COOKIE = "sa_token";
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function buildCookie(token: string, maxAge: number) {
  return `${SESSION_COOKIE}=${token}; Path=/superadmin; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

function getTokenFromRequest(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}

function isValidToken(token: string | null): boolean {
  if (!token) return false;
  const secret = process.env.SUPERADMIN_SECRET;
  if (!secret) return false;
  // Token format: base64(secret:timestamp)
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [s, ts] = decoded.split(":");
    if (s !== secret) return false;
    return Date.now() - Number(ts) < TOKEN_TTL_MS;
  } catch {
    return false;
  }
}

function createToken(): string {
  const secret = process.env.SUPERADMIN_SECRET ?? "";
  return Buffer.from(`${secret}:${Date.now()}`).toString("base64");
}

// ---------- Loader ----------
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const token = getTokenFromRequest(request);
  if (!isValidToken(token)) {
    return { authed: false, orders: [], shops: [], stats: null };
  }

  const url = new URL(request.url);
  const shopFilter = url.searchParams.get("shop") ?? "";
  const searchTerm = url.searchParams.get("q") ?? "";

  const [orders, shops] = await Promise.all([
    searchOrders({ shopDomain: shopFilter || undefined, search: searchTerm || undefined, limit: 200 }),
    getAllShops(),
  ]);

  return {
    authed: true,
    orders,
    shops,
    shopFilter,
    searchTerm,
    stats: {
      totalOrders: orders.length,
      totalShops: shops.length,
      activeShops: shops.filter((s) => s.isActive).length,
    },
  };
};

// ---------- Action (login / logout) ----------
export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "login") {
    const password = formData.get("password") as string;
    if (password === process.env.SUPERADMIN_SECRET) {
      const token = createToken();
      return redirect("/superadmin", {
        headers: { "Set-Cookie": buildCookie(token, 60 * 60 * 8) },
      });
    }
    return { loginError: "Invalid password." };
  }

  if (intent === "logout") {
    return redirect("/superadmin", {
      headers: { "Set-Cookie": buildCookie("", 0) },
    });
  }

  return null;
};

// ---------- Utility ----------
function fmtDate(ts: unknown): string {
  if (!ts || typeof ts !== "object") return "—";
  const s = (ts as { _seconds: number })._seconds;
  return new Date(s * 1000).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------- Component ----------
export default function Superadmin() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [pwVisible, setPwVisible] = useState(false);

  // ---- Login screen ----
  if (!data.authed) {
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Superadmin — InkCanvas</title>
          <style>{loginStyles}</style>
        </head>
        <body>
          <div className="login-wrap">
            <div className="login-card">
              <h1>⬛ InkCanvas</h1>
              <p className="sub">Superadmin access</p>
              {actionData && "loginError" in actionData && (
                <p className="error">{actionData.loginError}</p>
              )}
              <Form method="post">
                <input type="hidden" name="intent" value="login" />
                <div className="field">
                  <label htmlFor="password">Password</label>
                  <div className="pw-row">
                    <input
                      id="password"
                      name="password"
                      type={pwVisible ? "text" : "password"}
                      placeholder="Enter superadmin password"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="toggle-pw"
                      onClick={() => setPwVisible((v) => !v)}
                      aria-label="Toggle password visibility"
                    >
                      {pwVisible ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>
                <button type="submit" className="btn-primary">
                  Sign in
                </button>
              </Form>
            </div>
          </div>
        </body>
      </html>
    );
  }

  // ---- Dashboard ----
  const { orders, shops, stats, shopFilter, searchTerm } = data as {
    orders: Awaited<ReturnType<typeof searchOrders>>;
    shops: Awaited<ReturnType<typeof getAllShops>>;
    stats: { totalOrders: number; totalShops: number; activeShops: number };
    shopFilter: string;
    searchTerm: string;
  };

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Superadmin — InkCanvas</title>
        <style>{dashboardStyles}</style>
      </head>
      <body>
        <header className="header">
          <span className="logo">⬛ InkCanvas Superadmin</span>
          <Form method="post" style={{ display: "inline" }}>
            <input type="hidden" name="intent" value="logout" />
            <button type="submit" className="btn-logout">Sign out</button>
          </Form>
        </header>

        {/* Stats */}
        <section className="stats">
          <div className="stat-card">
            <div className="stat-num">{stats.totalShops}</div>
            <div className="stat-label">Total Shops</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">{stats.activeShops}</div>
            <div className="stat-label">Active Shops</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">{stats.totalOrders}</div>
            <div className="stat-label">Customized Orders (filtered)</div>
          </div>
        </section>

        {/* Filters */}
        <section className="filters">
          <Form method="get">
            <select name="shop" defaultValue={shopFilter}>
              <option value="">All shops</option>
              {shops.map((s) => (
                <option key={s.domain} value={s.domain}>
                  {s.domain}
                </option>
              ))}
            </select>
            <input
              name="q"
              defaultValue={searchTerm}
              type="search"
              placeholder="Search customer / order #"
            />
            <button type="submit" className="btn-primary">Filter</button>
            <a href="/superadmin" className="btn-reset">Reset</a>
          </Form>
        </section>

        {/* Orders table */}
        <section className="table-wrap">
          {orders.length === 0 ? (
            <p className="empty">No orders match your filters.</p>
          ) : (
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Shop</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Text / Font</th>
                  <th>Preview</th>
                  <th>Downloads</th>
                </tr>
              </thead>
              <tbody>
                {orders.flatMap((order) =>
                  order.customizations.map((c, ci) => (
                    <tr key={`${order.id}-${ci}`}>
                      <td>#{order.shopifyOrderNumber}</td>
                      <td className="shop-cell">{order.shopDomain}</td>
                      <td>{fmtDate(order.createdAt)}</td>
                      <td>
                        <div>{order.customerName}</div>
                        <div className="sub-text">{order.customerEmail}</div>
                      </td>
                      <td>
                        <div>{c.productTitle}</div>
                        {c.variantTitle && (
                          <div className="sub-text">{c.variantTitle}</div>
                        )}
                      </td>
                      <td>
                        {c.customText && <div>📝 {c.customText}</div>}
                        {c.fontName && <div className="sub-text">🔡 {c.fontName}</div>}
                      </td>
                      <td>
                        {c.designImageUrl ? (
                          <a href={c.designImageUrl} target="_blank" rel="noopener noreferrer">
                            <img
                              src={c.designImageUrl}
                              alt="Canvas design"
                              className="thumb"
                            />
                          </a>
                        ) : (
                          <span className="sub-text">—</span>
                        )}
                      </td>
                      <td className="dl-cell">
                        {c.rawImageUrl && (
                          <a href={c.rawImageUrl} target="_blank" rel="noopener noreferrer" className="dl-btn">
                            Raw
                          </a>
                        )}
                        {c.designImageUrl && (
                          <a href={c.designImageUrl} target="_blank" rel="noopener noreferrer" className="dl-btn dl-btn--primary">
                            Design
                          </a>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </section>
      </body>
    </html>
  );
}

// ---- Inline styles ----
const loginStyles = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f6f8; }
  .login-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .login-card { background: #fff; border-radius: 12px; padding: 40px; width: 360px; box-shadow: 0 4px 24px rgba(0,0,0,.1); }
  h1 { margin: 0 0 4px; font-size: 24px; }
  .sub { color: #6b7280; margin: 0 0 24px; font-size: 14px; }
  .error { color: #dc2626; font-size: 14px; margin-bottom: 16px; }
  .field { margin-bottom: 20px; }
  .field label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; }
  .pw-row { display: flex; gap: 8px; }
  input[type=password], input[type=text] { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
  .toggle-pw { background: none; border: 1px solid #d1d5db; border-radius: 8px; padding: 0 10px; cursor: pointer; font-size: 16px; }
  .btn-primary { width: 100%; padding: 12px; background: #111827; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
  .btn-primary:hover { background: #1f2937; }
`;

const dashboardStyles = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f6f8; color: #111827; }
  .header { display: flex; align-items: center; justify-content: space-between; padding: 14px 24px; background: #111827; color: #fff; }
  .logo { font-size: 18px; font-weight: 700; }
  .btn-logout { background: none; border: 1px solid rgba(255,255,255,.4); color: #fff; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; }
  .stats { display: flex; gap: 16px; padding: 24px 24px 0; flex-wrap: wrap; }
  .stat-card { background: #fff; border-radius: 10px; padding: 20px 24px; flex: 1; min-width: 160px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .stat-num { font-size: 32px; font-weight: 700; color: #111827; }
  .stat-label { font-size: 13px; color: #6b7280; margin-top: 4px; }
  .filters { padding: 20px 24px; }
  .filters form { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .filters select, .filters input[type=search] { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
  .filters input[type=search] { min-width: 240px; }
  .btn-primary { padding: 8px 18px; background: #111827; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
  .btn-reset { padding: 8px 18px; background: #fff; color: #374151; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; text-decoration: none; }
  .table-wrap { padding: 0 24px 40px; overflow-x: auto; }
  .empty { color: #6b7280; text-align: center; padding: 40px 0; }
  .orders-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.08); font-size: 13px; }
  .orders-table th { background: #f9fafb; padding: 12px 14px; text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
  .orders-table td { padding: 12px 14px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  .orders-table tr:last-child td { border-bottom: none; }
  .orders-table tr:hover td { background: #f9fafb; }
  .sub-text { color: #9ca3af; font-size: 12px; margin-top: 2px; }
  .shop-cell { font-size: 12px; color: #374151; max-width: 140px; word-break: break-all; }
  .thumb { width: 56px; height: 56px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; }
  .dl-cell { white-space: nowrap; }
  .dl-btn { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; text-decoration: none; background: #f3f4f6; color: #374151; margin-right: 6px; border: 1px solid #e5e7eb; }
  .dl-btn--primary { background: #111827; color: #fff; border-color: #111827; }
`;
