import React from 'react';
import { render } from '@testing-library/react';

import { UserProvider } from '../../../src/static/js/utils/contexts/UserContext';
import { useUser } from '../../../src/static/js/utils/hooks/useUser';
import { sampleMediaCMSConfig } from '../../tests-constants';

jest.mock('../../../src/static/js/utils/settings/config', () => ({
    config: jest.fn(() => jest.requireActual('../../tests-constants').sampleMediaCMSConfig),
}));

function getRenderers() {
    const data: { current: any } = { current: undefined };

    const Comp: React.FC = () => {
        data.current = useUser();
        return null;
    };

    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => <UserProvider>{children}</UserProvider>;

    return { Comp, wrapper, data };
}

describe('utils/hooks', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('useUser', () => {
        test('Validate value', () => {
            const { Comp, wrapper, data } = getRenderers();

            render(<Comp />, { wrapper });

            expect(data.current).toStrictEqual({
                isAnonymous: sampleMediaCMSConfig.member.is.anonymous,
                username: sampleMediaCMSConfig.member.username,
                thumbnail: sampleMediaCMSConfig.member.thumbnail,
                userCan: sampleMediaCMSConfig.member.can,
                pages: sampleMediaCMSConfig.member.pages,
            });
        });
    });
});
