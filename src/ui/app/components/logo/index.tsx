// Copyright (c) 2022, Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import classnames from 'classnames/bind';

import Icon, { SuiIcons } from '_components/icon';

import st from './Logo.module.scss';

const cl = classnames.bind(st);

type LogoProps = {
    size?: 'normal' | 'big' | 'bigger' | 'huge';
    txt?: boolean;
    className?: string;
};

const Logo = ({ size = 'normal', txt = false, className }: LogoProps) => {
    return (
        <div className={cl('container', className, size)}>
            <Icon className={cl('icon')} icon={SuiIcons.LowResEthos} />
            {/* {txt ? (
                <Icon className={cl('txt')} icon={SuiIcons.LowResEthosText} />
            ) : null} */}
        </div>
    );
};

export default Logo;
