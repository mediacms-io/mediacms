import React from 'react';
import { createContext, ReactNode } from 'react';
import { config as mediacmsConfig } from '../settings/config';

const member = mediacmsConfig(window.MediaCMS).member;
export const UserContext = createContext({
    isAnonymous: member.is.anonymous,
    username: member.username,
    thumbnail: member.thumbnail,
    userCan: member.can,
    pages: member.pages,
});

export function UserProvider({ children }: { children: ReactNode }) {
    const value = {
        isAnonymous: member.is.anonymous,
        username: member.username,
        thumbnail: member.thumbnail,
        userCan: member.can,
        pages: member.pages,
    };

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export const UserConsumer = UserContext.Consumer;

export default UserContext;
