import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { kindInfo } from "@/lib/creation-kinds";
import { getCreation, inspiringSightings } from "@/lib/creations";
import { formatWhen } from "@/lib/media";
import { deleteCreation, toggleMoved } from "../actions";
import { DeleteCreationButton } from "./delete-button";

/** One creation, shown with care: a painting beside the moment that inspired it, a poem set like a book page, audio over the sighting. */
export default async function CreationPage({ params }: PageProps<"/adda/[id]">) {
  const member = await getCurrentMember();
  const { id } = await params;
  const c = await getCreation(id);
  if (!c) notFound();
  const sightings = await inspiringSightings(c.sightingIds);
  const mine = c.author_id === member.id;
  const admin = member.role === "admin";
  const photos = c.media.filter((m) => m.media_type === "photo" && m.url);
  const videos = c.media.filter((m) => m.media_type === "video" && m.url);
  const audio = c.media.find((m) => m.media_type === "audio" && m.url);
  const moment = sightings.find((s) => s.photo);
  const movedByMe = c.moved.some((m) => m.member_id === member.id);
  const author = mine ? "you" : (c.author?.name ?? "a teammate");

  return (
    <article className="mx-auto max-w-4xl">
      <Link href="/adda" className="text-sm text-muted hover:text-ink">
        ← Creative Adda
      </Link>
      <header className="mt-4">
        <p className="text-sm text-forest-700">{kindInfo(c.kind).label}</p>
        <h1 className="mt-1 font-serif text-[2.5rem] font-semibold leading-tight">{c.title}</h1>
        <p className="mt-1 text-muted">
          By {author}, {formatWhen(c.created_at, false)}
        </p>
      </header>

      {/* The work */}
      <div className="mt-8">
        {photos.length > 0 && moment && (
          <div className="grid gap-4 sm:grid-cols-2">
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={moment.photo!} alt={`The sighting: ${moment.title}`} className="aspect-[4/5] w-full rounded-md object-cover" />
              <figcaption className="mt-2 text-sm text-muted">The moment: {moment.title}</figcaption>
            </figure>
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photos[0].url!} alt={c.title} className="aspect-[4/5] w-full rounded-md bg-wash object-contain" />
              <figcaption className="mt-2 text-sm text-muted">The creation</figcaption>
            </figure>
          </div>
        )}
        {photos.length > 0 && !moment && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photos[0].url!} alt={c.title} className="max-h-[80vh] w-full rounded-md bg-wash object-contain" />
        )}
        {photos.length > 1 && (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {photos.slice(1).map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.url!} alt="" className="w-full rounded-md bg-wash object-contain" />
            ))}
          </div>
        )}
        {videos.map((v) => (
          <video key={v.id} src={v.url!} controls className="mt-4 w-full rounded-md bg-black" />
        ))}

        {audio && (
          <div className="mt-4 overflow-hidden rounded-xl border border-line bg-paper">
            {moment && photos.length === 0 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={moment.photo!} alt={`The sighting: ${moment.title}`} className="max-h-[60vh] w-full object-cover" />
            )}
            <div className="p-4">
              <audio controls preload="metadata" src={audio.url!} className="w-full" />
            </div>
          </div>
        )}

        {c.text_body && (
          <div
            className={`mx-auto mt-8 max-w-2xl font-serif text-ink ${
              c.kind === "poem" ? "whitespace-pre-wrap text-xl leading-[1.9]" : "whitespace-pre-line text-lg leading-[1.85]"
            }`}
          >
            {c.text_body}
          </div>
        )}

        {c.link_url && (
          <p className="mt-6">
            <a href={c.link_url} target="_blank" rel="noopener noreferrer" className="font-medium text-forest-700 hover:underline">
              Open the link ↗
            </a>
          </p>
        )}
      </div>

      {/* This moved me */}
      <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <form action={toggleMoved}>
          <input type="hidden" name="id" value={c.id} />
          <button
            type="submit"
            aria-pressed={movedByMe}
            className={`inline-flex h-10 items-center rounded-full px-5 text-sm font-medium ${
              movedByMe ? "bg-forest-600 text-white hover:bg-forest-700" : "border border-forest-600 text-forest-800 hover:bg-forest-50"
            }`}
          >
            {movedByMe ? "✓ This moved me" : "This moved me"}
          </button>
        </form>
        {c.moved.length > 0 && (
          <p className="text-sm text-muted">
            Moved: {c.moved.map((m) => (m.member_id === member.id ? "you" : (m.name ?? "a teammate"))).join(", ")}
          </p>
        )}
      </div>

      {/* Inspired by */}
      <section className="mt-8">
        <h2 className="font-serif text-xl font-medium">Inspired by</h2>
        {sightings.length === 0 ? (
          <p className="mt-1 text-muted">Kanha</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {sightings.map((s) => (
              <li key={s.id}>
                <Link href={`/observations/${s.id}`} className="flex items-center gap-3 rounded-md border border-line bg-paper p-2 hover:border-forest-600">
                  {s.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.photo} alt="" className="h-14 w-14 rounded object-cover" />
                  ) : (
                    <span className="h-14 w-14 rounded bg-wash" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-serif font-semibold">{s.title}</span>
                    <span className="block text-sm text-muted">
                      {s.observer_id === member.id ? "Your sighting" : `${s.observer_name ?? "A teammate"}'s sighting`}, {formatWhen(s.observed_at, false)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(mine || admin) && (
        <div className="mt-10 flex items-center gap-4 border-t border-line pt-6 text-sm">
          {mine && (
            <Link href={`/adda/${c.id}/edit`} className="font-medium text-forest-700 hover:underline">
              Edit
            </Link>
          )}
          <div className="ml-auto">
            <DeleteCreationButton id={c.id} action={deleteCreation} owner={mine ? null : (c.author?.name ?? "a teammate")} />
          </div>
        </div>
      )}
    </article>
  );
}
