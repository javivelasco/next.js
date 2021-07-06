import Link from 'next/link'

export default function Main() {
  return (
    <div>
      <p className="title">Home Page</p>
      <Link href="/stream-response">
        <a>Stream a response</a>
      </Link>
      <div />
      <Link href="/rewrite-me-to-about">
        <a>Rewrite me to about</a>
      </Link>
      <div />
      <Link href="/rewrite-me-to-vercel">
        <a>Rewrite me to Vercel</a>
      </Link>
    </div>
  )
}
