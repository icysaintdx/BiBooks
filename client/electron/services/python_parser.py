#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BiBooks 增强 PDF 解析脚本
支持：opendataloader-pdf（本地模式）、MinerU（pipeline 模式）
调用方式：python python_parser.py <provider> <input_path> [output_dir]
退出码：0=成功，1=失败
输出：stdout=markdown内容，stderr=错误信息
"""

import sys
import os
import json
import tempfile
import shutil


def parse_with_opendataloader(input_path: str) -> str:
    import opendataloader_pdf
    with tempfile.TemporaryDirectory() as tmp_dir:
        opendataloader_pdf.convert(
            input_path=[input_path],
            output_dir=tmp_dir,
            format="markdown",
        )
        # 查找输出的 .md 文件
        for root, _dirs, files in os.walk(tmp_dir):
            for fname in files:
                if fname.endswith(".md"):
                    with open(os.path.join(root, fname), encoding="utf-8") as f:
                        return f.read()
    return ""


def parse_with_mineru(input_path: str) -> str:
    from mineru.backend.pipeline.pipeline_analyze import doc_analyze
    from mineru.backend.pipeline.pipeline_middle_json_mkcontent import union_make
    from mineru.backend.utils.content_utils import DropMode, MakeMode

    with tempfile.TemporaryDirectory() as tmp_dir:
        output_dir = os.path.join(tmp_dir, "output")
        os.makedirs(output_dir, exist_ok=True)
        doc_analyze(
            pdf_path=input_path,
            output_dir=output_dir,
            end_page=None,
        )
        # 查找输出的 .md 文件
        for root, _dirs, files in os.walk(output_dir):
            for fname in files:
                if fname.endswith(".md"):
                    with open(os.path.join(root, fname), encoding="utf-8") as f:
                        return f.read()
    return ""


def main():
    if len(sys.argv) < 3:
        print("用法: python python_parser.py <provider> <input_path>", file=sys.stderr)
        sys.exit(1)

    provider = sys.argv[1]
    input_path = sys.argv[2]

    if not os.path.exists(input_path):
        print(f"文件不存在: {input_path}", file=sys.stderr)
        sys.exit(1)

    try:
        if provider == "opendataloader":
            result = parse_with_opendataloader(input_path)
        elif provider == "mineru-local":
            result = parse_with_mineru(input_path)
        else:
            print(f"未知解析器: {provider}", file=sys.stderr)
            sys.exit(1)

        sys.stdout.write(result)
        sys.exit(0)
    except ImportError as e:
        print(f"依赖未安装: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"解析失败: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
