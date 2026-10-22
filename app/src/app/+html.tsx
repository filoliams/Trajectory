import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/** The web page shell: title, description and the dark ground before the app paints. */
export default function Root({ children }: PropsWithChildren) {
  // SDK 58: the app's scripts and styles arrive as head/body nodes; without them the page never loads.
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();
  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Trajectory</title>
        <meta name="description" content="Know what to study next, every day. Your assessments, deadlines and notes in one plan." />
        <meta name="theme-color" content="#0B0B0F" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: 'body { background-color: #0B0B0F; }' }} />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
