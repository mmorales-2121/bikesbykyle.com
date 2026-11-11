import Link from "next/link";
import { business, categories, formatPrice, services } from "@/config/business";

const dur = (m: number) => (m < 120 ? `${m} min` : `${Math.round(m / 30) / 2} hr`);

export default function Home() {
  return (
    <>
      <p className="eyebrow">★ ★ ★ Austin, TX</p>
      <h1>Book your <em>bike service</em></h1>
      <p className="muted">Choose a service, pick a time, and pay online or at pickup. Labor prices shown; parts are extra.</p>
      <div id="services" className="cats">
        {categories.map((cat, i) => {
          const list = services.filter((s) => s.category === cat);
          return (
            <details key={cat} className="cat" name="cats" open={i === 0}>
              <summary>
                <span className="ctitle">{cat}</span>
                <span className="cmeta">{list.length} {list.length === 1 ? "service" : "services"} · from {formatPrice(Math.min(...list.map((s) => s.priceCents)))}</span>
                <span className="chev" aria-hidden="true">▼</span>
              </summary>
              <ul className="menu">
                {list.map((s) => (
                  <li key={s.id}>
                    <Link className="svc" href={`/book/${s.id}`}>
                      <span><span className="name">{s.name}</span><br /><span className="desc">{s.description}</span></span>
                      <span className="time">about {dur(s.durationMinutes)}</span>
                      <span className="sprice">{formatPrice(s.priceCents)}</span>
                      <span className="go">Book ›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </>
  );
}
