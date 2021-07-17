import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserCache } from '../../../utils/classes';
import { SiteContext } from '../../../utils/contexts';
import { enabled as langEnabled, labels as langLabels } from '../../../utils/languages';
import { MaterialIcon } from '../../_shared';

import './LanguageOptions.scss';

interface LanguageOptionProps {
  code: string;
  label: string;
  active: boolean;
}

export const LanguageOption: React.FC<LanguageOptionProps> = ({ code, label, active }) => {
  const { i18n } = useTranslation();
  const onClick = () => i18n.changeLanguage(code);
  return (
    <span className={'language-option' + (active ? ' selected-language' : '')}>
      <button onClick={onClick}>
        {active && <MaterialIcon type="check" />}
        {label}
      </button>
    </span>
  );
};

export const LanguageOptions: React.FC = () => {
  const site = useContext(SiteContext);
  const [browserCache, setBrowserCache] = useState(null);

  const { i18n } = useTranslation();
  const [languages, setLanguages] = useState<string[]>([]);
  const [current, setCurrent] = useState<string>(i18n.language);

  useEffect(() => {
    // @ts-ignore
    setBrowserCache(new BrowserCache('MediaCMS[' + site.id + '][language]', 86400));
  }, [site.id]);

  useEffect(() => {
    setCurrent(i18n.language);
    if (browserCache) {
      // @ts-ignore
      browserCache.set('code', i18n.language);
    }
  }, [i18n.language]);

  useEffect(() => {
    const lang: string[] = [];
    for (let k in langEnabled) {
      lang.push(langEnabled[k]);
    }
    setLanguages(lang);
  }, []);

  return (
    <div className="language-options">
      {languages.map((code) => (
        <LanguageOption key={code} code={code} label={langLabels[code] || code} active={code === current} />
      ))}
    </div>
  );
};
