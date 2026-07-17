import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #2a1d12 0%, #120d09 45%, #050505 100%)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "760px",
          textAlign: "center",
          padding: "48px 28px",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: "24px",
          background: "rgba(0,0,0,0.45)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
        }}
      >
        <p
          style={{
            margin: "0 0 12px",
            textTransform: "uppercase",
            letterSpacing: "0.22em",
            fontSize: "14px",
            color: "#d7b98c",
          }}
        >
          Southern Utah
        </p>

        <h1
          style={{
            margin: 0,
            fontSize: "clamp(42px, 8vw, 78px)",
            lineHeight: 0.95,
          }}
        >
          Big Iron
          <br />
          Country Swing
        </h1>

        <p
          style={{
            margin: "24px auto 0",
            maxWidth: "560px",
            fontSize: "18px",
            lineHeight: 1.6,
            color: "rgba(255,255,255,0.75)",
          }}
        >
          Request songs, follow the queue, and keep the dance floor moving.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "14px",
            justifyContent: "center",
            marginTop: "34px",
          }}
        >
          <Link
            href="/request/big-iron"
            style={{
              textDecoration: "none",
              background: "#f1c27d",
              color: "#111",
              padding: "15px 24px",
              borderRadius: "999px",
              fontWeight: 800,
              fontSize: "16px",
            }}
          >
            Request a Song
          </Link>

          <Link
            href="/admin/login"
            style={{
              textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.28)",
              color: "white",
              padding: "15px 24px",
              borderRadius: "999px",
              fontWeight: 700,
              fontSize: "16px",
            }}
          >
            Admin Login
          </Link>
        </div>
      </section>
    </main>
  );
}