"use client";

import { useMemo } from "react";
import { Box, Button, Flex, Link, Popover, Portal, Text } from "@chakra-ui/react";
import { logoCredits } from "@repo/routemap/rint-catalog";

/**
 * The page's standing credit line, naming the authors of the logos on screen.
 *
 * Wikipedia discharges image attribution two ways at once: a site footer stating the
 * licence, AND every image linking to its file description page, which is where the
 * author is named. We keep the footer but lose the second half — {{rint}} points a
 * logo at the OPERATOR's article and we reproduce that faithfully, so clicking a logo
 * here never reaches the page naming who made it. The credits list restores that path
 * without putting a credit beside every logo in the diagram.
 *
 * Only logos that actually require a credit are listed; `logoCredits` filters on
 * Commons' own per-file flag, which keeps the public-domain and CC0 majority out of
 * the way. The list follows whatever diagram is on screen rather than the whole
 * catalog, so it stays short enough to be read.
 */
export function CreditsFooter({ files }: { files: string[] }) {
  const credits = useMemo(() => logoCredits(files), [files]);

  return (
    <Flex
      as="footer"
      align="center"
      justify="space-between"
      gap="3"
      px="3"
      py="1.5"
      borderTopWidth="1px"
      borderColor="border"
      bg="bg.subtle"
      fontSize="xs"
      color="fg.muted"
      flexShrink="0"
    >
      <Text>
        Route symbols and transit logos from{" "}
        <Link
          href="https://commons.wikimedia.org/"
          target="_blank"
          rel="noreferrer"
        >
          Wikimedia Commons
        </Link>
        , under their own licences.
      </Text>

      {credits.length > 0 ? (
        <Popover.Root positioning={{ placement: "top-end" }} lazyMount unmountOnExit>
          <Popover.Trigger asChild>
            {/* A button, not a link: it opens a panel rather than going anywhere.
                `plain` because a footer wants the weight of text, not a control. */}
            <Button variant="plain" size="xs" textDecoration="underline" flexShrink="0">
              Logo credits ({credits.length})
            </Button>
          </Popover.Trigger>
          <Portal>
            <Popover.Positioner>
              <Popover.Content width="380px" maxHeight="60vh" overflow="auto">
                <Popover.Arrow />
                <Popover.Body fontSize="xs">
                  <Text mb="2" color="fg.muted">
                    These logos are used under a licence that requires crediting
                    their author. Each name links to the file page carrying the
                    full terms.
                  </Text>
                  <Flex direction="column" gap="1.5">
                    {credits.map((credit) => (
                      <Box key={credit.file}>
                        <Link
                          href={credit.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {credit.file}
                        </Link>
                        {credit.author ? ` — ${credit.author}` : null}
                        {" · "}
                        {credit.licenceUrl ? (
                          <Link
                            href={credit.licenceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {credit.licence}
                          </Link>
                        ) : (
                          credit.licence
                        )}
                      </Box>
                    ))}
                  </Flex>
                </Popover.Body>
              </Popover.Content>
            </Popover.Positioner>
          </Portal>
        </Popover.Root>
      ) : null}
    </Flex>
  );
}
