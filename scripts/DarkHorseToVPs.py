#!/usr/bin/env python3
# Basic script to convert a Dark Horse Comics JSON metadata file to Rickert's panel format.
import json
import sys

def eprint(*args, **kwargs):
    print(*args, file = sys.stderr, **kwargs)

def RoundDict(Input):
    for Key, Value in Input.items():
        Input[Key] = round(Value, 3)
    return Input

def ProcessDHFile(InputFilename):
    with open(InputFilename, 'r') as File:
        Input = json.load(File)

    PageCount = Input['page_count']
    if PageCount != len(Input['pages']):
        raise Exception('Page count doesn\'t matches pages in file. {} != {}.'.format(Input['page_count'], len(Input['pages'])))

    RightToLeft = Input['is_rtl']

    PageRange = range(PageCount) if not RightToLeft else range(PageCount - 1, -1, -1)

    NewPages = []
    TotalViewports = 0

    RealPageNum = 0
    SortOrder = None

    for PageNum in PageRange:
        RealPageNum += 1
        Page = Input['pages'][PageNum]

        # Perform some basic error checking.
        if not SortOrder or ((not RightToLeft and SortOrder < Page['sort_order']) or (RightToLeft and SortOrder > Page['sort_order'])):
            SortOrder = Page['sort_order']
        else:
            raise Exception('Sort order doesn\'t match. {} != {}.'.format(SortOrder, Page['sort_order']))

        if Page['book_id'] != Input['id']:
            eprint('book_id doesn\'t match! {} != {}'.format(Page['book_id'], Input['id']))

        if Page['skip']:
            eprint('Page {} is skip!'.format(RealPageNum))
        # Think is used for the store page. A way to see some panels.
        if Page['is_preview']:
            eprint('Page {} is a preview page.'.format(RealPageNum))
        if Page['title']:
            eprint('Page {} has a title; {}'.format(RealPageNum, Page['title']))

        # Viewpoints
        VPs = Page['viewports']
        VPRange = range(len(VPs)) if not RightToLeft else range(len(VPs) - 1, -1, -1)

        NewViewpoint = []

        RealVPNum = 0
        for VPNum in VPRange:
            RealVPNum += 1
            TotalViewports += 1
            VP = VPs[VPNum]

            # Perform some basic error checking.
            if VP['sort_order'] != RealVPNum:
                raise Exception('Viewpoint {} sort order on page {} doesn\'t match. {} != {}.'.format(VP['id'], RealPageNum, RealVPNum, VP['sort_order']))
            if VP['page_id'] != Page['id']:
                eprint('page_id of viewpoint ID {} on page {} doesn\'t match! {} != {}'.format(VP['id'], RealPageNum, VP['page_id'], Page['id']))

            if VP['ext_url']:
                eprint('Viewpoint ID {} on page {} has an external URL; {}'.format(VP['id'], RealPageNum, Page['ext_url']))

            V = {'X': VP['pos_x'] / Page['width'], 'Y': VP['pos_y'] / Page['height'], 'W': VP['width'] / Page['width'], 'H': VP['height'] / Page['height']}
            V = RoundDict(V)
            NewViewpoint.append(V)

        # If the only viewport is the full size, remove it for slight compression.
        if len(NewViewpoint) == 1 and not Page['skip'] and VP['pos_x'] == 0 and VP['pos_y'] == 0 and VP['width'] == Page['width'] and VP['height'] == Page['height']:
            eprint('Skipping single full viewpoint on page {}.'.format(RealPageNum))
            NewViewpoint = None

        NewPages.append(NewViewpoint)

    if Input['viewport_count'] != TotalViewports:
        eprint('viewport_count doesn\'t match! {} != {}'.format(Input['viewport_count'], TotalViewports))

    return NewPages

if __name__ == '__main__':
    if len(sys.argv) < 2:
        eprint("Usage: {} filename".format(sys.argv[0]))
        sys.exit(2)
    Data = ProcessDHFile(sys.argv[1])
    print(json.dumps(Data))

