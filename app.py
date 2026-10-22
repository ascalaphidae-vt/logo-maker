import streamlit as st
from pathlib import Path
st.set_page_config(page_title='Pop Logo Studio',layout='wide')
st.title('Pop Logo Studio — 試運転版')
st.caption('Chrome / Edge 推奨。ローカルフォントの取得にはブラウザの許可が必要です。')
html=Path(__file__).with_name('editor.html').read_text(encoding='utf-8')
st.components.v1.html(html,height=960,scrolling=True)
