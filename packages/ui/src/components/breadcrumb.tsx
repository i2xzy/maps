import {
  Breadcrumb as ChakraBreadcrumb,
  type SystemStyleObject,
} from '@chakra-ui/react';
import * as React from 'react';

export interface BreadcrumbProps extends ChakraBreadcrumb.RootProps {
  separator?: React.ReactNode;
  separatorGap?: SystemStyleObject['gap'];
  items: Array<{ title: React.ReactNode; url?: string }>;
}

export const Breadcrumb = React.forwardRef<HTMLDivElement, BreadcrumbProps>(
  function BreadcrumbRoot(props, ref) {
    const { separator, separatorGap, items, ...rest } = props;

    return (
      <ChakraBreadcrumb.Root ref={ref} {...rest}>
        <ChakraBreadcrumb.List gap={separatorGap}>
          {items.map((item, index) => {
            const last = index === items.length - 1;
            return (
              <React.Fragment key={index}>
                <ChakraBreadcrumb.Item wordBreak='auto-phrase'>
                  {last ? (
                    <ChakraBreadcrumb.CurrentLink>
                      {item.title}
                    </ChakraBreadcrumb.CurrentLink>
                  ) : (
                    <ChakraBreadcrumb.Link href={item.url}>
                      {item.title}
                    </ChakraBreadcrumb.Link>
                  )}
                </ChakraBreadcrumb.Item>
                {!last && (
                  <ChakraBreadcrumb.Separator>
                    {separator}
                  </ChakraBreadcrumb.Separator>
                )}
              </React.Fragment>
            );
          })}
        </ChakraBreadcrumb.List>
      </ChakraBreadcrumb.Root>
    );
  }
);
