import React, { createContext } from 'react';
import { config as mediacmsConfig } from '../settings/config.js';

export const UserContext = createContext();

const member = mediacmsConfig(window.MediaCMS).member;

export const UserProvider = ({ children }) => {
  const value = {
    isAnonymous: member.is.anonymous,
    username: member.username,
    thumbnail: member.thumbnail,
    userCan: member.can,
    pages: member.pages,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const UserConsumer = UserContext.Consumer;

export default UserContext;