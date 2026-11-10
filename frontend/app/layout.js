import "./styles.css";

export const metadata = {
  title: "Fiddle | Violin practice",
  description: "Read your sheet music alongside measure-specific practice tips.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
