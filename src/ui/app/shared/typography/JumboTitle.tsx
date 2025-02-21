import Typography, { type TypographyProps } from './Typography';

const JumboTitle = (props: TypographyProps) => {
    const titleClasses =
        'font-weight-ethos-jumbo-title text-size-ethos-jumbo-title leading-line-height-ethos-jumbo-title tracking-letter-spacing-ethos-jumbo-title';
    return (
        <Typography
            className={props.className + ' ' + titleClasses}
            as={props.as}
            isTextColorMedium={props.isTextColorMedium}
        >
            {props.children}
        </Typography>
    );
};

export default JumboTitle;
