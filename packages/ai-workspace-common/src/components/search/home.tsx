import React, { useState } from 'react';
import { Command } from 'cmdk';
import { useSearchStore } from '@refly-packages/ai-workspace-common/stores/search';
import * as Popover from '@radix-ui/react-popover';
import { Logo, LinearIcon, FigmaIcon, SlackIcon, YouTubeIcon, RaycastIcon } from './icons';
import {} from '@heroicons/react/24/outline';
import {
  IconSearch,
  IconMessage,
  IconFile,
  IconApps,
  IconBook,
  IconEdit,
  IconRobot,
} from '@arco-design/web-react/icon';
import { useDebouncedCallback } from 'use-debounce';
import { defaultFilter } from './cmdk/filter';

import './index.scss';
import { Modal } from '@arco-design/web-react';
import { Item } from './item';

// request
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { SearchDomain, SearchRequest, SearchResult } from '@refly/openapi-schema';
import { useNavigate } from 'react-router-dom';

export function Home({
  pages,
  setPages,
  displayMode,
  data,
  activeValue,
}: {
  data: { domain: string; heading: string; data: SearchResult[]; icon: React.ReactNode }[];
  pages: string[];
  setPages: (pages: string[]) => void;
  displayMode: 'list' | 'search';
  activeValue: string;
}) {
  const navigate = useNavigate();
  const searchStore = useSearchStore();

  console.log('renderData', data);

  return (
    <>
      {/* <Command.Group heading="Projects">
          <Item
            shortcut="S P"
            onSelect={() => {
              searchProjects();
            }}
          >
            <ProjectsIcon />
            Search Projects...
          </Item>
          <Item>
            <PlusIcon />
            Create New Project...
          </Item>
        </Command.Group> */}
      <Command.Group heading="建议">
        <Item
          value="refly-built-in-ask-ai"
          keywords={['NewConv']}
          activeValue={activeValue}
          onSelect={() => {
            // searchProjects();
          }}
        >
          <IconMessage style={{ fontSize: 12 }} />
          问问知识管家
        </Item>
        <Item
          value="refly-built-in-ai-online-search"
          keywords={['AISearch']}
          activeValue={activeValue}
          onSelect={() => {
            // searchProjects();
          }}
        >
          <IconSearch style={{ fontSize: 12 }} />
          AI 联网搜索
        </Item>
        <Item
          value="refly-built-in-ai-knowledgebase-search"
          keywords={['AISearch']}
          activeValue={activeValue}
          onSelect={() => {
            // searchProjects();
          }}
        >
          <IconSearch style={{ fontSize: 12 }} />
          AI 知识库搜索
        </Item>
      </Command.Group>
      {data
        .filter((item) => item?.data?.length > 0)
        .map((renderItem, index) => (
          <Command.Group heading={renderItem?.heading}>
            {renderItem?.data?.slice(0, 5)?.map((item, index) => (
              <Item
                key={index}
                value={`${renderItem?.domain}-${index}-${item?.title}-${item?.content?.[0] || ''}`}
                activeValue={activeValue}
                onSelect={() => {
                  if (renderItem?.domain === 'skill') {
                  } else if (renderItem?.domain === 'note') {
                    navigate(`/knowledge-base?noteId=${item?.id}`);
                  } else if (renderItem?.domain === 'readResources') {
                    navigate(`/knowledge-base?kbId=${item?.metadata?.collectionId}&resId=${item?.id}`);
                  } else if (renderItem?.domain === 'knowledgeBases') {
                    navigate(`/knowledge-base?kbId=${item?.id}`);
                  } else if (renderItem?.domain === 'convs') {
                    navigate(`/knowledge-base?convId=${item?.id}`);
                  }

                  searchStore.setIsSearchOpen(false);
                }}
              >
                {renderItem?.icon}
                <div className="search-res-container">
                  <p className="search-res-title" dangerouslySetInnerHTML={{ __html: item?.title }}></p>
                  {item?.content?.length > 0 && (
                    <p className="search-res-desc" dangerouslySetInnerHTML={{ __html: item?.content?.[0] || '' }}></p>
                  )}
                </div>
              </Item>
            ))}
            {displayMode === 'list' && renderItem?.data?.length > 0 ? (
              <Item
                value={`all${renderItem?.domain}`}
                keywords={['']}
                onSelect={() => {
                  setPages([...pages, renderItem?.domain]);
                }}
                activeValue={activeValue}
              >
                <IconApps style={{ fontSize: 12 }} />
                查看所有{renderItem?.heading}
              </Item>
            ) : null}
          </Command.Group>
        ))}
    </>
  );
}
