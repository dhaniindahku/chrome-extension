// Copyright (c) 2022, Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';

import Sui from './Sui';
import UnknownToken from './UnknownToken';
import { useFormatCoin } from '_src/ui/app/hooks/useFormatCoin';

export type CoinProps = {
    type: string;
    balance: bigint;
    hideStake?: boolean;
    mode?: 'row-item' | 'standalone';
};

function CoinBalance({ type, balance }: CoinProps) {
    const [balanceFormatted, symbol, usdAmount] = useFormatCoin(balance, type);

    const sendUrl = useMemo(
        () => `/send?${new URLSearchParams({ type }).toString()}`,
        [type]
    );

    return (
        <Link to={sendUrl}>
            <div className="flex items-align justify-between mt-3">
                <div className="flex gap-4 items-align">
                    <div className="flex items-center">
                        {symbol === 'SUI' ? <Sui /> : <UnknownToken />}
                    </div>
                    <div className="flex flex-col items-start">
                        <div className="font-light text-base">{symbol}</div>
                        <div className="font-light text-sm text-slate-500 dark:text-slate-400">
                            {balanceFormatted}
                        </div>
                    </div>
                </div>
                <div className="flex items-center text-base text-slate-800 dark:text-slate-300">
                    <div>{usdAmount}</div>
                </div>
            </div>
        </Link>
    );
}

export default memo(CoinBalance);
