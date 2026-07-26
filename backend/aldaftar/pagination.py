from rest_framework.pagination import PageNumberPagination


class ConfigurablePageNumberPagination(PageNumberPagination):
    """
    Page-number pagination that honours ?page_size=.

    Every grid in the frontend asks for exactly the number of rows it
    renders — 4 for a section block, 5 for the most-read sidebar, 50 for a
    dashboard table. Plain PageNumberPagination ignores the parameter and
    serves PAGE_SIZE to all of them, so dashboards silently truncate.
    """

    page_size_query_param = "page_size"
    max_page_size = 200
