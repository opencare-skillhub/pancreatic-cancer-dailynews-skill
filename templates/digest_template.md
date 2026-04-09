---
# Full digest template (Jinja2-style - for future enhancement)
# Currently using string formatting in fetch.py

date: "{{ date }}"
generated_at: "{{ generated_at }}"
total_items: "{{ total_items }}"

sections:
  clinical_trials:
    title: "🔬 临床试验更新"
    items: "{{ trials }}"
  research_articles:
    title: "📚 最新研究文献"
    items: "{{ articles }}"
  news:
    title: "📰 行业动态"
    items: "{{ news }}"

---
# Highlights template (for group chat)

{{ emoji }} 胰腺癌医学日报 · {{ date }} · {{ count }}条更新

{% for item in items[:5] %}
{{ loop.index }}. [{{ item.external_id }}] {{ item.title }}
    {{ item.summary }}
    {{ ' '.join(item.tags) }}
{% endfor %}

{% if items|length > 5 %}... 还有 {{ items|length - 5 }} 条，查看完整报告{% endif %}

📋 数据源: ClinicalTrials.gov, PubMed, RSS
🔗 完整报告: {{ wiki_url }}
