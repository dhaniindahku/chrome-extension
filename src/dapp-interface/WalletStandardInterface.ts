// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

// import { Base64DataBuffer } from '@mysten/sui.js';
import {
    SUI_CHAINS,
    ReadonlyWalletAccount,
    type SuiSignAndExecuteTransactionFeature,
    type SuiSignAndExecuteTransactionMethod,
    type ConnectFeature,
    type ConnectMethod,
    type Wallet,
    type EventsFeature,
    type EventsOnMethod,
    type EventsListeners,
    type DisconnectFeature,
    type DisconnectMethod,
    // type SignMessageFeature,
    // type SignMessageMethod,
} from '@mysten/wallet-standard';
import mitt, { type Emitter } from 'mitt';
import { filter, map, type Observable } from 'rxjs';

import icon from '../manifest/icons/ethos-icon-150.png';
import { mapToPromise } from './utils';
import { createMessage } from '_messages';
import { WindowMessageStream } from '_messaging/WindowMessageStream';
import { type Payload } from '_payloads';
import {
    type AcquirePermissionsRequest,
    type AcquirePermissionsResponse,
    ALL_PERMISSION_TYPES,
} from '_payloads/permissions';
// import { deserializeSignaturePubkeyPair } from '_src/shared/signature-serialization';

import type { GetAccount } from '_payloads/account/GetAccount';
import type { GetAccountResponse } from '_payloads/account/GetAccountResponse';
// import type { ExecuteSignMessageRequest } from '_payloads/messages/ExecuteSignMessageRequest';
// import type { ExecuteSignMessageResponse } from '_payloads/messages/ExecuteSignMessageResponse';
import type {
    ExecuteTransactionRequest,
    ExecuteTransactionResponse,
} from '_payloads/transactions';
import type { DisconnectRequest } from '_src/shared/messaging/messages/payloads/connections/DisconnectRequest';
import type { DisconnectResponse } from '_src/shared/messaging/messages/payloads/connections/DisconnectResponse';

type WalletEventsMap = {
    [E in keyof EventsListeners]: Parameters<EventsListeners[E]>[0];
};

// TODO: rebuild event interface with Mitt.
export class EthosWallet implements Wallet {
    readonly #events: Emitter<WalletEventsMap>;
    readonly #version = '1.0.0' as const;
    readonly #name = 'Ethos Wallet' as const;
    #account: ReadonlyWalletAccount | null;
    #messagesStream: WindowMessageStream;

    get version() {
        return this.#version;
    }

    get name() {
        return this.#name;
    }

    get icon() {
        // TODO: Improve this with ideally a vector logo.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return icon as any;
    }

    get chains() {
        // TODO: Extract chain from wallet:
        return SUI_CHAINS;
    }

    get features(): ConnectFeature &
        DisconnectFeature &
        EventsFeature &
        // SignMessageFeature &
        SuiSignAndExecuteTransactionFeature {
        return {
            'standard:connect': {
                version: '1.0.0',
                connect: this.#connect,
            },
            'standard:disconnect': {
                version: '1.0.0',
                disconnect: this.#disconnect,
            },
            'standard:events': {
                version: '1.0.0',
                on: this.#on,
            },
            // 'standard:signMessage': {
            //     version: '1.0.0',
            //     signMessage: this.#signMessage,
            // },
            'sui:signAndExecuteTransaction': {
                version: '1.0.0',
                signAndExecuteTransaction: this.#signAndExecuteTransaction,
            },
        };
    }

    get accounts() {
        return this.#account ? [this.#account] : [];
    }

    constructor() {
        this.#events = mitt();
        this.#account = null;
        this.#messagesStream = new WindowMessageStream(
            'ethos_in-page',
            'ethos_content-script'
        );

        this.#connected();
    }

    #on: EventsOnMethod = (event, listener) => {
        this.#events.on(event, listener);
        return () => this.#events.off(event, listener);
    };

    #connected = async () => {
        const accounts = await mapToPromise(
            this.#send<GetAccount, GetAccountResponse>({
                type: 'get-account',
            }),
            (response) => response.accounts
        );

        const [address] = accounts;

        if (address) {
            const account = this.#account;
            if (!account || account.address !== address) {
                this.#account = new ReadonlyWalletAccount({
                    address,
                    publicKey: new Uint8Array(),
                    chains: SUI_CHAINS,
                    features: [
                        'sui:signAndExecuteTransaction',
                        'standard:signMessage',
                    ],
                });
                this.#events.emit('change', { accounts: this.accounts });
            }
        }
    };

    #connect: ConnectMethod = async (input) => {
        if (!input?.silent) {
            await mapToPromise(
                this.#send<
                    AcquirePermissionsRequest,
                    AcquirePermissionsResponse
                >({
                    type: 'acquire-permissions-request',
                    permissions: ALL_PERMISSION_TYPES,
                }),
                (response) => response.result
            );
        }

        await this.#connected();

        return { accounts: this.accounts };
    };

    #disconnect: DisconnectMethod = async () => {
        await mapToPromise(
            this.#send<DisconnectRequest, DisconnectResponse>({
                type: 'disconnect-request',
            }),
            (response) => response.success
        );
    };

    #signAndExecuteTransaction: SuiSignAndExecuteTransactionMethod = async (
        input
    ) => {
        return mapToPromise(
            this.#send<ExecuteTransactionRequest, ExecuteTransactionResponse>({
                type: 'execute-transaction-request',
                transaction: {
                    type: 'v2',
                    data: input.transaction,
                },
            }),
            (response) => response.result
        );
    };

    // #signMessage: SignMessageMethod = async (input) => {
    //     let { message } = input;

    //     let messageData;
    //     let messageString;

    //     // convert utf8 string to Uint8Array
    //     if (typeof message === 'string') {
    //         messageString = message;
    //         message = new Uint8Array(Buffer.from(message, 'utf8'));
    //     }

    //     // convert Uint8Array to base64 string
    //     if (message instanceof Uint8Array) {
    //         messageData = new Base64DataBuffer(message).toString();
    //     }

    //     return mapToPromise(
    //         this.send<ExecuteSignMessageRequest, ExecuteSignMessageResponse>({
    //             type: 'execute-sign-message-request',
    //             messageData,
    //             messageString,
    //         }),
    //         (response) =>
    //             response.signature
    //                 ? deserializeSignaturePubkeyPair(response.signature)
    //                 : undefined
    //     );
    // };

    #send<
        RequestPayload extends Payload,
        ResponsePayload extends Payload | void = void
    >(
        payload: RequestPayload,
        responseForID?: string
    ): Observable<ResponsePayload> {
        const msg = createMessage(payload, responseForID);
        this.#messagesStream.send(msg);
        return this.#messagesStream.messages.pipe(
            filter(({ id }) => id === msg.id),
            map((msg) => msg.payload as ResponsePayload)
        );
    }
}
