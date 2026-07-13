import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            fontFamily: "system-ui, sans-serif",
            background: "#f5f5f7",
          }}
        >
          <div style={{ maxWidth: 520, background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 8px 24px rgba(0,0,0,.08)" }}>
            <h1 style={{ margin: "0 0 8px", fontSize: 20 }}>画面の読み込みに失敗しました</h1>
            <p style={{ margin: "0 0 12px", color: "#666", lineHeight: 1.6 }}>
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: "#1b7f3b",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              再読み込み
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
