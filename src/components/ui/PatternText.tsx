'use client';

type Tag = 'h1' | 'h2' | 'h3' | 'span' | 'p';

interface PatternTextProps {
  children: string;
  fontSize?: string;
  className?: string;
  tag?: Tag;
}

export default function PatternText({
  children,
  fontSize = '3rem',
  className = '',
  tag: Tag = 'span',
}: PatternTextProps) {
  return (
    <Tag
      className={`pattern-text${className ? ' ' + className : ''}`}
      style={{ fontSize }}
      data-text={children}
    >
      {children}
    </Tag>
  );
}
