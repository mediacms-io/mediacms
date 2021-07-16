import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { enabled as langEnabled, translations as langTranslations, selected as langSelected } from '.';

// the translations
// (tip move them in a JSON file and import them,
// or even better, manage them via a UI: https://react.i18next.com/guides/multiple-translation-files#manage-your-translations-with-a-management-gui)
const resources: {
  [key: string]: {
    translation: { [key: string]: string };
  };
} = {};

for (let k in langEnabled) {
  resources[langEnabled[k]] = { translation: langTranslations[langEnabled[k]] };
}

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources,
    lng: langSelected, // if you're using a language detector, do not define the lng option & // language to use, more information here: https://www.i18next.com/overview/configuration-options#languages-namespaces-resources
    fallbackLng: langSelected,
    // you can use the i18n.changeLanguage function to change the language manually: https://www.i18next.com/overview/api#changelanguage
    // if you're using a language detector, do not define the lng option

    interpolation: {
      escapeValue: false, // react already safes from xss
    },

    // react-i18next options
    react: {
      wait: true,
    },
  });

export default i18n;
