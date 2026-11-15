import React, { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

// Stored format shared with the backend (files/methods.py check_comment_for_mention).
const MENTION_PATTERN = /@\(_(.+?)_\)\[_(.+?)_\]/g;
const QUERY_PATTERN = /(?:^|\s)@([^\s@]*)$/;

const highlighterStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  boxSizing: 'border-box',
  overflow: 'hidden',
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  color: 'transparent',
  pointerEvents: 'none',
  textAlign: 'start',
};

const rootStyle = {
  position: 'relative',
  overflowY: 'visible',
};

const textareaStyle = {
  position: 'relative',
};

const suggestionsListStyle = {
  margin: 0,
  padding: 0,
  listStyleType: 'none',
};

export function mentionMarkup(id, display) {
  return '@(_' + id + '_)[_' + display + '_]';
}

export function parseMentions(markup) {
  const pattern = new RegExp(MENTION_PATTERN.source, 'g');
  const mentions = [];
  let plainText = '';
  let lastIndex = 0;
  let match;

  while (null !== (match = pattern.exec(markup))) {
    plainText += markup.slice(lastIndex, match.index);
    mentions.push({
      id: match[1],
      display: match[2],
      plainStart: plainText.length,
      plainEnd: plainText.length + match[2].length,
      markupStart: match.index,
      markupEnd: match.index + match[0].length,
    });
    plainText += match[2];
    lastIndex = pattern.lastIndex;
  }

  plainText += markup.slice(lastIndex);

  return { plainText, mentions };
}

function plainToMarkupIndex(parsed, position) {
  let offset = 0;

  for (const mention of parsed.mentions) {
    if (position <= mention.plainStart) {
      break;
    }

    if (position < mention.plainEnd) {
      return mention.markupStart;
    }

    offset += mention.markupEnd - mention.markupStart - (mention.plainEnd - mention.plainStart);
  }

  return position + offset;
}

// The caret marks where the inserted text ends, which disambiguates edits inside repeated characters.
export function diffText(oldText, newText, caret) {
  const maxSuffix = Math.min(oldText.length, newText.length - Math.min(caret, newText.length));
  let suffix = 0;
  while (suffix < maxSuffix && oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]) {
    suffix++;
  }

  const maxPrefix = Math.min(oldText.length, newText.length) - suffix;
  let prefix = 0;
  while (prefix < maxPrefix && oldText[prefix] === newText[prefix]) {
    prefix++;
  }

  return {
    start: prefix,
    end: oldText.length - suffix,
    inserted: newText.slice(prefix, newText.length - suffix),
  };
}

// A mention is atomic: any edit that touches its text removes the whole mention.
export function applyPlainTextChange(markup, parsed, start, end, inserted) {
  let from = start;
  let to = end;

  for (const mention of parsed.mentions) {
    const overlaps =
      start === end
        ? mention.plainStart < start && start < mention.plainEnd
        : mention.plainStart < end && start < mention.plainEnd;

    if (overlaps) {
      from = Math.min(from, mention.plainStart);
      to = Math.max(to, mention.plainEnd);
    }
  }

  return {
    markup: markup.slice(0, plainToMarkupIndex(parsed, from)) + inserted + markup.slice(plainToMarkupIndex(parsed, to)),
    caret: from + inserted.length,
  };
}

export function findMentionQuery(parsed, caret) {
  const match = QUERY_PATTERN.exec(parsed.plainText.slice(0, caret));

  if (!match) {
    return null;
  }

  const triggerIndex = caret - match[1].length - 1;

  if (parsed.mentions.some((mention) => mention.plainStart < caret && triggerIndex < mention.plainEnd)) {
    return null;
  }

  return { triggerIndex, query: match[1] };
}

export function filterMentionUsers(users, query) {
  const needle = query.toLowerCase();

  return users.filter(
    (user) =>
      String(user.display || user.id).toLowerCase().includes(needle) || String(user.id).toLowerCase().includes(needle)
  );
}

function renderHighlighter(parsed, caret, caretRef) {
  const nodes = [];
  let position = 0;
  let caretRendered = null === caret;

  function pushText(text, from) {
    if (!caretRendered && caret >= from && caret <= from + text.length) {
      nodes.push(text.slice(0, caret - from));
      nodes.push(<span key="caret" ref={caretRef} />);
      nodes.push(text.slice(caret - from));
      caretRendered = true;
    } else {
      nodes.push(text);
    }
  }

  parsed.mentions.forEach((mention, i) => {
    pushText(parsed.plainText.slice(position, mention.plainStart), position);
    nodes.push(<strong key={'mention-' + i}>{mention.display}</strong>);
    position = mention.plainEnd;
  });

  pushText(parsed.plainText.slice(position), position);

  return nodes;
}

export function MentionTextarea({
  value,
  onChange,
  users = [],
  inputRef,
  className = '',
  onBlur,
  onKeyDown,
  ...textareaProps
}) {
  const parsed = useMemo(() => parseMentions(value), [value]);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [suggestionsPosition, setSuggestionsPosition] = useState(null);
  const localRef = useRef(null);
  const textareaRef = inputRef || localRef;
  const caretRef = useRef(null);
  const pendingCaret = useRef(null);
  const listId = useId();

  const suggestions = useMemo(
    () => (null === mentionQuery ? [] : filterMentionUsers(users, mentionQuery.query)),
    [users, mentionQuery]
  );
  const isOpen = 0 < suggestions.length;
  const focusedIndex = Math.min(activeIndex, suggestions.length - 1);

  useLayoutEffect(() => {
    if (null !== pendingCaret.current && textareaRef.current) {
      textareaRef.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  });

  useLayoutEffect(() => {
    if (isOpen && caretRef.current) {
      setSuggestionsPosition({
        top: caretRef.current.offsetTop + (parseFloat(window.getComputedStyle(caretRef.current).lineHeight) || 0),
        left: caretRef.current.offsetLeft,
      });
    }
  }, [isOpen, mentionQuery, value]);

  function updateQuery(nextParsed, caret) {
    const nextQuery = findMentionQuery(nextParsed, caret);
    setMentionQuery(nextQuery);
    if (null === nextQuery || null === mentionQuery || nextQuery.query !== mentionQuery.query) {
      setActiveIndex(0);
    }
  }

  function emitChange(event, nextMarkup, caret, nextPlainText) {
    const nextParsed = parseMentions(nextMarkup);

    if (nextParsed.plainText !== nextPlainText || textareaRef.current?.selectionEnd !== caret) {
      pendingCaret.current = caret;
    }

    updateQuery(nextParsed, caret);
    onChange(event, nextMarkup, nextParsed.plainText);
  }

  function handleChange(event) {
    const newText = event.target.value;
    const caret = null === event.target.selectionEnd ? newText.length : event.target.selectionEnd;
    const change = diffText(parsed.plainText, newText, caret);
    const next = applyPlainTextChange(value, parsed, change.start, change.end, change.inserted);

    emitChange(event, next.markup, next.caret, newText);
  }

  function selectSuggestion(event, user) {
    const display = user.display || String(user.id);
    const start = mentionQuery.triggerIndex;
    const end = start + 1 + mentionQuery.query.length;
    const nextMarkup =
      value.slice(0, plainToMarkupIndex(parsed, start)) +
      mentionMarkup(user.id, display) +
      value.slice(plainToMarkupIndex(parsed, end));

    emitChange(event, nextMarkup, start + display.length, null);
    setMentionQuery(null);
  }

  function handleKeyDown(event) {
    if (isOpen) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setActiveIndex((focusedIndex + 1) % suggestions.length);
          return;
        case 'ArrowUp':
          event.preventDefault();
          setActiveIndex((focusedIndex - 1 + suggestions.length) % suggestions.length);
          return;
        case 'Enter':
        case 'Tab':
          event.preventDefault();
          selectSuggestion(event, suggestions[focusedIndex]);
          return;
        case 'Escape':
          event.preventDefault();
          setMentionQuery(null);
          return;
      }
    }

    if (onKeyDown) {
      onKeyDown(event);
    }
  }

  function handleSelect(event) {
    const textarea = event.target;

    // Skip the select event that fires together with a change, before the new value is rendered.
    if (textarea.value !== parsed.plainText) {
      return;
    }

    if (textarea.selectionStart !== textarea.selectionEnd) {
      setMentionQuery(null);
      return;
    }

    updateQuery(parsed, textarea.selectionEnd);
  }

  function handleBlur(event) {
    setMentionQuery(null);

    if (onBlur) {
      onBlur(event);
    }
  }

  const caret = isOpen ? mentionQuery.triggerIndex : null;

  return (
    <div className={className} style={rootStyle}>
      <div className={className + '__control'} style={{ position: 'relative' }}>
        <div className={className + '__highlighter'} style={highlighterStyle} aria-hidden="true">
          {renderHighlighter(parsed, caret, caretRef)}
        </div>
        <textarea
          {...textareaProps}
          ref={textareaRef}
          className={className + '__input'}
          style={textareaProps.style ? { ...textareaStyle, ...textareaProps.style } : textareaStyle}
          value={parsed.plainText}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          onBlur={handleBlur}
          aria-autocomplete="list"
          aria-controls={isOpen ? listId : undefined}
          aria-activedescendant={isOpen ? listId + '-' + focusedIndex : undefined}
        />
      </div>
      {isOpen ? (
        <div
          className={className + '__suggestions'}
          style={{
            position: 'absolute',
            zIndex: 1,
            minWidth: 100,
            top: suggestionsPosition ? suggestionsPosition.top : undefined,
            left: suggestionsPosition ? suggestionsPosition.left : undefined,
          }}
        >
          <ul id={listId} role="listbox" className={className + '__suggestions__list'} style={suggestionsListStyle}>
            {suggestions.map((user, i) => (
              <li
                key={user.id}
                id={listId + '-' + i}
                role="option"
                aria-selected={i === focusedIndex}
                className={
                  className +
                  '__suggestions__item' +
                  (i === focusedIndex ? ' ' + className + '__suggestions__item--focused' : '')
                }
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={(event) => selectSuggestion(event, user)}
              >
                {user.display || user.id}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
