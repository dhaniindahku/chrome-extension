// Copyright (c) 2022, Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

// import { getTransactionDigest } from '@mysten/sui.js';
import BigNumber from 'bignumber.js';
import { Formik } from 'formik';
import { useCallback, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import TransferCoinForm from './TransferCoinForm';
import { createTokenValidation } from './validation';
import Loading from '_components/loading';
import { useAppSelector, useAppDispatch } from '_hooks';
import { accountAggregateBalancesSelector } from '_redux/slices/account';
import { Coin, GAS_TYPE_ARG } from '_redux/slices/sui-objects/Coin';
import { sendTokens } from '_redux/slices/transactions';
import {
    useCoinDecimals,
    useFormatCoin,
} from '_src/ui/app/hooks/useFormatCoin';
import NavBarWithBackAndTitle from '_src/ui/app/shared/navigation/nav-bar/NavBarWithBackAndTitle';

import type { SerializedError } from '@reduxjs/toolkit';
import type { FormikHelpers } from 'formik';

const initialValues = {
    to: '',
    amount: '',
};

export type FormValues = typeof initialValues;

// TODO: show out of sync when sui objects locally might be outdated
function TransferCoinPage() {
    const [searchParams] = useSearchParams();
    const coinType = useMemo(() => searchParams.get('type'), [searchParams]);
    const aggregateBalances = useAppSelector(accountAggregateBalancesSelector);
    const coinBalance = useMemo(
        () => (coinType && aggregateBalances[coinType]) || BigInt(0),
        [coinType, aggregateBalances]
    );
    const gasAggregateBalance = useMemo(
        () => aggregateBalances[GAS_TYPE_ARG] || BigInt(0),
        [aggregateBalances]
    );

    const coinSymbol = useMemo(
        () => (coinType && Coin.getCoinSymbol(coinType)) || '',
        [coinType]
    );

    const [coinDecimals] = useCoinDecimals(coinType);
    const [gasDecimals] = useCoinDecimals(GAS_TYPE_ARG);

    const [formattedBalance] = useFormatCoin(coinBalance, coinType);
    // const [formattedTotal] = useFormatCoin(totalGasCoins, GAS_TYPE_ARG);
    // const [formattedGas] = useFormatCoin(gasAggregateBalance, GAS_TYPE_ARG);

    const [sendError, setSendError] = useState<string | null>(null);
    const validationSchema = useMemo(
        () =>
            createTokenValidation(
                coinType || '',
                coinBalance,
                coinSymbol,
                gasAggregateBalance,
                coinDecimals,
                gasDecimals
            ),
        [
            coinType,
            coinBalance,
            coinSymbol,
            gasAggregateBalance,
            coinDecimals,
            gasDecimals,
        ]
    );
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const onHandleSubmit = useCallback(
        async (
            { to, amount }: FormValues,
            { resetForm }: FormikHelpers<FormValues>
        ) => {
            if (coinType === null) {
                return;
            }
            setSendError(null);
            try {
                const bigIntAmount = BigInt(
                    new BigNumber(amount)
                        .shiftedBy(coinDecimals)
                        .integerValue()
                        .toString()
                );

                // const response = await dispatch(
                //     sendTokens({
                //         amount: bigIntAmount,
                //         recipientAddress: to,
                //         tokenTypeArg: coinType,
                //     })
                // ).unwrap();
                await dispatch(
                    sendTokens({
                        amount: bigIntAmount,
                        recipientAddress: to,
                        tokenTypeArg: coinType,
                    })
                );

                resetForm();
                // const txDigest = getTransactionDigest(response);
                // const receiptUrl = `/receipt?txdigest=${encodeURIComponent(
                //     txDigest
                // )}&transfer=coin`;
                const receiptUrl = '/tokens';

                navigate(receiptUrl);
            } catch (e) {
                setSendError((e as SerializedError).message || null);
            }
        },
        [dispatch, navigate, coinType, coinDecimals]
    );
    const handleOnClearSubmitError = useCallback(() => {
        setSendError(null);
    }, []);
    const loadingBalance = useAppSelector(
        ({ suiObjects }) => suiObjects.loading && !suiObjects.lastSync
    );
    if (!coinType) {
        return <Navigate to="/" replace={true} />;
    }
    return (
        <>
            <NavBarWithBackAndTitle
                title={'Send ' + coinSymbol}
                backLink="/tokens"
            />
            <Loading loading={loadingBalance} big={true}>
                <Formik
                    initialValues={initialValues}
                    validateOnMount={true}
                    validationSchema={validationSchema}
                    onSubmit={onHandleSubmit}
                >
                    <TransferCoinForm
                        submitError={sendError}
                        coinBalance={formattedBalance.toString()}
                        coinSymbol={coinSymbol}
                        onClearSubmitError={handleOnClearSubmitError}
                    />
                </Formik>
            </Loading>
        </>
    );
}

export default TransferCoinPage;
