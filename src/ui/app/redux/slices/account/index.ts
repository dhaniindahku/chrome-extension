// Copyright (c) 2022, Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    createAsyncThunk,
    createSelector,
    createSlice,
} from '@reduxjs/toolkit';

import { suiObjectsAdapterSelectors } from '_redux/slices/sui-objects';
import { Coin } from '_redux/slices/sui-objects/Coin';
import { generateMnemonic } from '_shared/cryptography/mnemonics';
import Authentication from '_src/background/Authentication';
import { PERMISSIONS_STORAGE_KEY } from '_src/background/Permissions';
import {
    getEncrypted,
    setEncrypted,
    deleteEncrypted,
} from '_src/shared/storagex/store';
import KeypairVault from '_src/ui/app/KeypairVault';
import { AUTHENTICATION_REQUESTED } from '_src/ui/app/pages/initialize/hosted';

import type { AppThunkConfig } from '../../store/thunk-extras';
import type { SuiAddress, SuiMoveObject, SuiObject } from '@mysten/sui.js';
import type { AsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '_redux/RootReducer';
import type { AccountInfo } from '_src/ui/app/KeypairVault';

type InitialAccountInfo = {
    authentication: string | null;
    mnemonic: string | null;
    passphrase: string | null;
    accountInfos: AccountInfo[];
    activeAccountIndex: number;
};

/*
    The has_public_transfer was added to make sure the SuiSystemState object isn't
    shown as an NFT. This forced us to extend the anObj type because there is no
    such object on the SuiObject type of the mysten NPM package.
*/
type SuiObjectWithPublicTransfer = SuiObject & {
    data: {
        has_public_transfer: boolean;
    };
};

export const LOCKED = 'locked';

export const loadAccountInformationFromStorage = createAsyncThunk(
    'account/loadAccountInformation',
    async (): Promise<InitialAccountInfo> => {
        let activeAccountIndex = 0;

        let authentication = await getEncrypted('authentication');

        if (authentication) {
            let accountInfos: AccountInfo[] = [];
            if (authentication !== AUTHENTICATION_REQUESTED) {
                Authentication.set(authentication);
                accountInfos = await Authentication.getAccountInfos();
                activeAccountIndex = parseInt(
                    (await getEncrypted(
                        'activeAccountIndex',
                        authentication
                    )) || '0'
                );

                if (!accountInfos || !accountInfos.length) {
                    authentication = null;
                }

                if (activeAccountIndex >= (accountInfos?.length || 0)) {
                    activeAccountIndex = (accountInfos?.length || 1) - 1;
                }
            }

            return {
                authentication: authentication || null,
                passphrase: null,
                mnemonic: null,
                accountInfos,
                activeAccountIndex,
            };
        }

        const passphrase = await getEncrypted('passphrase');
        if (!passphrase || passphrase.length === 0) {
            return {
                authentication: null,
                passphrase: null,
                mnemonic: null,
                accountInfos: [],
                activeAccountIndex: 0,
            };
        }

        if (passphrase === LOCKED) {
            return {
                authentication: null,
                passphrase: LOCKED,
                mnemonic: null,
                accountInfos: [],
                activeAccountIndex: 0,
            };
        }

        const mnemonic = await getEncrypted('mnemonic', passphrase);
        let accountInfos = JSON.parse(
            (await getEncrypted('accountInfos', passphrase)) || '[]'
        );

        if (accountInfos.length === 0 && mnemonic) {
            const keypairVault = new KeypairVault();
            keypairVault.mnemonic = mnemonic;
            accountInfos = [
                {
                    index: 0,
                    address: keypairVault.getAddress(0),
                    seed: (keypairVault.getSeed(0) || '').toString(),
                },
            ];
        }

        activeAccountIndex = parseInt(
            (await getEncrypted('activeAccountIndex', passphrase)) || '0'
        );

        if (activeAccountIndex >= (accountInfos?.length || 0)) {
            activeAccountIndex = (accountInfos?.length || 1) - 1;
        }

        return {
            authentication: authentication || null,
            passphrase: passphrase || null,
            mnemonic: mnemonic || null,
            accountInfos,
            activeAccountIndex,
        };
    }
);

export const getEmail = createAsyncThunk(
    'account/getEmail',
    async (): Promise<string | null> => {
        return await getEncrypted('email');
    }
);

export const createMnemonic = createAsyncThunk(
    'account/createMnemonic',
    async (
        existingMnemonic: string | undefined,
        { getState }
    ): Promise<string | null> => {
        const mnemonic = existingMnemonic || generateMnemonic();

        const {
            account: { passphrase },
        } = getState() as RootState;
        if (passphrase) {
            await setEncrypted('mnemonic', mnemonic, passphrase);
        }

        return mnemonic;
    }
);

export const saveAuthentication = createAsyncThunk(
    'account/setAuthentication',
    async (authentication: string | null, { getState }) => {
        if (!authentication) {
            await deleteEncrypted('authentication');
        } else {
            await setEncrypted('authentication', authentication);
        }
        return authentication;
    }
);

export const saveAccountInfos = createAsyncThunk(
    'account/setAccountInfos',
    async (
        accountInfos: AccountInfo[],
        { getState }
    ): Promise<AccountInfo[]> => {
        const {
            account: { passphrase },
        } = getState() as RootState;

        if (passphrase) {
            await setEncrypted(
                'accountInfos',
                JSON.stringify(accountInfos),
                passphrase
            );
        }

        return accountInfos;
    }
);

export const saveActiveAccountIndex = createAsyncThunk(
    'account/setActiveAccountIndex',
    async (activeAccountIndex: number, { getState }): Promise<number> => {
        const {
            account: { passphrase, authentication },
        } = getState() as RootState;
        await setEncrypted(
            'activeAccountIndex',
            activeAccountIndex.toString(),
            passphrase || authentication || undefined
        );
        return activeAccountIndex;
    }
);

export const saveEmail = createAsyncThunk(
    'account/setEmail',
    async (email: string | null) => {
        if (!email) {
            await deleteEncrypted('email');
        } else {
            await setEncrypted('email', email);
        }
        return email;
    }
);

export const savePassphrase: AsyncThunk<
    string | null,
    string | null,
    AppThunkConfig
> = createAsyncThunk<string | null, string | null, AppThunkConfig>(
    'account/setPassphrase',
    async (passphrase, { extra: { keypairVault }, getState }) => {
        if (!passphrase) {
            deleteEncrypted('passphrase');
            return null;
        }

        await setEncrypted('passphrase', passphrase);

        const {
            account: { mnemonic },
        } = getState() as RootState;

        if (passphrase && mnemonic) {
            await setEncrypted('mnemonic', mnemonic, passphrase);
            await setEncrypted(
                'accountInfos',
                JSON.stringify([
                    {
                        index: 0,
                        address: keypairVault.getAddress() || '',
                        seed: (keypairVault.getSeed() || '').toString(),
                    },
                ]),
                passphrase
            );
        }
        return passphrase;
    }
);

export const reset = createAsyncThunk(
    'account/reset',
    async (_args, { getState }): Promise<void> => {
        const {
            account: { passphrase },
        } = getState() as RootState;
        if (passphrase) {
            await deleteEncrypted('passphrase');
            await deleteEncrypted('mnemonic', passphrase);
            await deleteEncrypted('accountInfos', passphrase);
        }
        await deleteEncrypted('authentication');
        await deleteEncrypted('email');
        await deleteEncrypted('activeAccountIndex');
        await deleteEncrypted(PERMISSIONS_STORAGE_KEY);

        window.location.reload();
    }
);

export const logout = createAsyncThunk(
    'account/logout',
    async (_args): Promise<void> => {
        await setEncrypted('passphrase', LOCKED);
        await deleteEncrypted('authentication');

        window.location.reload();
    }
);

type AccountState = {
    loading: boolean;
    authentication: string | null;
    email: string | null;
    mnemonic: string | null;
    passphrase: string | null;
    creating: boolean;
    createdMnemonic: string | null;
    address: SuiAddress | null;
    accountInfos: AccountInfo[];
    activeAccountIndex: number;
};

const initialState: AccountState = {
    loading: true,
    authentication: null,
    email: null,
    mnemonic: null,
    passphrase: null,
    creating: false,
    createdMnemonic: null,
    address: null,
    accountInfos: [],
    activeAccountIndex: 0,
};

const accountSlice = createSlice({
    name: 'account',
    initialState,
    reducers: {
        setMnemonic: (state, action: PayloadAction<string | null>) => {
            state.mnemonic = action.payload;
        },
        setPassphrase: (state, action: PayloadAction<string | null>) => {
            state.passphrase = action.payload;
        },
        setAddress: (state, action: PayloadAction<string | null>) => {
            state.address = action.payload;
        },
        setAuthentication: (state, action: PayloadAction<string | null>) => {
            state.authentication = action.payload;
        },
        setAccountInfos: (state, action: PayloadAction<AccountInfo[]>) => {
            state.accountInfos = action.payload;
        },
        setActiveAccountIndex: (state, action: PayloadAction<number>) => {
            state.activeAccountIndex = action.payload;
        },
        setEmail: (state, action: PayloadAction<string | null>) => {
            state.email = action.payload;
        },
    },
    extraReducers: (builder) =>
        builder
            .addCase(
                loadAccountInformationFromStorage.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.authentication = action.payload.authentication;
                    state.passphrase = action.payload.passphrase;
                    state.mnemonic = action.payload.mnemonic;
                    state.accountInfos = action.payload.accountInfos;
                    state.activeAccountIndex =
                        action.payload.activeAccountIndex || 0;

                    state.address =
                        state.accountInfos.find(
                            (accountInfo) =>
                                (accountInfo.index || 0) ===
                                state.activeAccountIndex
                        )?.address || null;
                }
            )
            .addCase(createMnemonic.pending, (state) => {
                state.creating = true;
            })
            .addCase(createMnemonic.fulfilled, (state, action) => {
                state.creating = false;
                state.createdMnemonic = action.payload;
            })
            .addCase(createMnemonic.rejected, (state) => {
                state.creating = false;
                state.createdMnemonic = null;
            })
            .addCase(savePassphrase.fulfilled, (state, action) => {
                state.passphrase = action.payload;
            })
            .addCase(saveAccountInfos.fulfilled, (state, action) => {
                state.accountInfos = action.payload;
            })
            .addCase(saveActiveAccountIndex.fulfilled, (state, action) => {
                state.activeAccountIndex = action.payload;
                state.address =
                    state.accountInfos.find(
                        (accountInfo: AccountInfo) =>
                            (accountInfo.index || 0) ===
                            state.activeAccountIndex
                    )?.address || null;
            })
            .addCase(saveAuthentication.fulfilled, (state, action) => {
                state.authentication = action.payload;
            })
            .addCase(saveEmail.fulfilled, (state, action) => {
                state.email = action.payload;
            }),
});

export const { setMnemonic, setAddress, setAccountInfos, setAuthentication } =
    accountSlice.actions;

export default accountSlice.reducer;

export const accountCoinsSelector = createSelector(
    suiObjectsAdapterSelectors.selectAll,
    (allSuiObjects) => {
        return allSuiObjects
            .filter(Coin.isCoin)
            .map((aCoin) => aCoin.data as SuiMoveObject);
    }
);

// return an aggregate balance for each coin type
export const accountAggregateBalancesSelector = createSelector(
    accountCoinsSelector,
    (coins) => {
        return coins.reduce((acc, aCoin) => {
            const coinType = Coin.getCoinTypeArg(aCoin);
            if (coinType) {
                if (typeof acc[coinType] === 'undefined') {
                    acc[coinType] = BigInt(0);
                }
                acc[coinType] += Coin.getBalance(aCoin);
            }
            return acc;
        }, {} as Record<string, bigint>);
    }
);

// return a list of balances for each coin object for each coin type
export const accountItemizedBalancesSelector = createSelector(
    accountCoinsSelector,
    (coins) => {
        return coins.reduce((acc, aCoin) => {
            const coinType = Coin.getCoinTypeArg(aCoin);
            if (coinType) {
                if (typeof acc[coinType] === 'undefined') {
                    acc[coinType] = [];
                }
                acc[coinType].push(Coin.getBalance(aCoin));
            }
            return acc;
        }, {} as Record<string, bigint[]>);
    }
);

export const accountNftsSelector = createSelector(
    suiObjectsAdapterSelectors.selectAll,
    (allSuiObjects) => {
        return allSuiObjects.filter(
            /*
                The has_public_transfer was added to make sure the SuiSystemState object isn't
                shown as an NFT. This forced us to extend the anObj type because there is no
                such object on the SuiObject type of the mysten NPM package.
            */
            (anObj) => {
                const anObjWithPublicTransfer =
                    anObj as SuiObjectWithPublicTransfer;
                return (
                    !Coin.isCoin(anObj) &&
                    anObjWithPublicTransfer.data.has_public_transfer !== false
                );
            }
        );
    }
);

export const activeAccountSelector = ({ account }: RootState) =>
    account.address;
